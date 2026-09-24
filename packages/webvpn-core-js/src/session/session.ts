import { tryNormalizeHost } from "../routing/allowlist.ts";

export const STORAGE_KEYS = {
  schema: "swufe.plugin.schema",
  settings: "swufe.settings.v1",
  session: "swufe.session.v1",
  notificationThrottle: "swufe.notification-throttle.v1",
  lastError: "swufe.last-error.v1",
} as const;

export interface SessionRecordV1 {
  schemaVersion: 1;
  gatewayHost: string;
  cookieHeader: string;
  capturedAt: string;
  lastConfirmedAt: string | null;
  status: "captured" | "valid";
}

export interface SessionStore {
  load(): SessionRecordV1 | null;
  save(session: SessionRecordV1): boolean;
  clear(): boolean;
}

export interface SessionCaptureInput {
  url: string;
  headers: Record<string, string>;
  nowIso: string;
  gatewayHost: string;
}

export type SessionCaptureResult =
  | { kind: "captured"; session: SessionRecordV1 }
  | { kind: "no_cookie" }
  | { kind: "not_gateway" }
  | { kind: "invalid" };

export interface KeyValueStore {
  read(key: string): string | null;
  write(key: string, value: string | null): boolean;
}

export function createSessionStore(kv: KeyValueStore): SessionStore {
  return {
    load() {
      const raw = kv.read(STORAGE_KEYS.session);
      if (raw === null || raw === "") {
        return null;
      }
      const parsed = parseSession(raw);
      if (parsed.kind === "ok") {
        return parsed.session;
      }
      kv.write(STORAGE_KEYS.session, null);
      return null;
    },
    save(session) {
      return kv.write(STORAGE_KEYS.session, JSON.stringify(session));
    },
    clear() {
      return kv.write(STORAGE_KEYS.session, null);
    },
  };
}

export type SessionParseResult =
  | { kind: "ok"; session: SessionRecordV1 }
  | { kind: "corrupt" }
  | { kind: "incompatible" };

export function parseSession(raw: string): SessionParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "corrupt" };
  }
  if (!data || typeof data !== "object") {
    return { kind: "corrupt" };
  }
  const record = data as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    return typeof record.schemaVersion === "number" ? { kind: "incompatible" } : { kind: "corrupt" };
  }
  if (
    typeof record.gatewayHost !== "string" ||
    typeof record.cookieHeader !== "string" ||
    typeof record.capturedAt !== "string" ||
    (record.lastConfirmedAt !== null && typeof record.lastConfirmedAt !== "string") ||
    (record.status !== "captured" && record.status !== "valid") ||
    record.cookieHeader.length === 0
  ) {
    return { kind: "corrupt" };
  }
  return {
    kind: "ok",
    session: {
      schemaVersion: 1,
      gatewayHost: record.gatewayHost,
      cookieHeader: record.cookieHeader,
      capturedAt: record.capturedAt,
      lastConfirmedAt: record.lastConfirmedAt,
      status: record.status,
    },
  };
}

export function captureSession(input: SessionCaptureInput): SessionCaptureResult {
  let host = "";
  try {
    host = new URL(input.url).hostname;
  } catch {
    return { kind: "invalid" };
  }
  const normalized = tryNormalizeHost(host);
  const gateway = tryNormalizeHost(input.gatewayHost);
  if (!normalized || !gateway) {
    return { kind: "invalid" };
  }
  if (normalized !== gateway) {
    return { kind: "not_gateway" };
  }
  const cookie = headerValue(input.headers, "cookie").trim();
  if (!cookie) {
    return { kind: "no_cookie" };
  }
  return {
    kind: "captured",
    session: {
      schemaVersion: 1,
      gatewayHost: gateway,
      cookieHeader: cookie,
      capturedAt: input.nowIso,
      lastConfirmedAt: null,
      status: "captured",
    },
  };
}

/** Newer gateway cookie replaces the stored header. A valid session stays valid. */
export function applyNewerCookie(current: SessionRecordV1, captured: SessionRecordV1): SessionRecordV1 {
  if (current.gatewayHost !== captured.gatewayHost) {
    return captured;
  }
  if (current.cookieHeader === captured.cookieHeader) {
    return current;
  }
  return {
    ...captured,
    status: current.status === "valid" ? "valid" : "captured",
    lastConfirmedAt: current.status === "valid" ? current.lastConfirmedAt : null,
  };
}

export function sessionMatchesGateway(session: SessionRecordV1 | null, gatewayHost: string): session is SessionRecordV1 {
  if (!session) {
    return false;
  }
  const left = tryNormalizeHost(session.gatewayHost);
  const right = tryNormalizeHost(gatewayHost);
  return left !== null && left === right;
}

export function promoteSession(session: SessionRecordV1, nowIso: string): SessionRecordV1 {
  return { ...session, status: "valid", lastConfirmedAt: nowIso };
}

export function headerValue(headers: Record<string, string>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return "";
}

export function memoryKv(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = { ...initial };
  return {
    read(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] ?? null : null;
    },
    write(key, value) {
      if (value === null) {
        delete data[key];
      } else {
        data[key] = value;
      }
      return true;
    },
    dump() {
      return { ...data };
    },
  };
}
