import { tryNormalizeHost } from "../routing/allowlist.ts";

export const STORAGE_KEYS = {
  schema: "swufe.plugin.schema",
  settings: "swufe.settings.v1",
  settingsV2: "swufe.settings.v2",
  settingsCsrf: "swufe.settings.csrf.v1",
  session: "swufe.session.v1",
  notificationThrottle: "swufe.notification-throttle.v1",
  lastError: "swufe.last-error.v1",
} as const;

/** WebVPN session ticket. Auxiliary cookies such as `show_faq` are not a lifetime. */
export const TICKET_COOKIE_NAME = "wengine_vpn_ticketwebvpn_swufe_edu_cn";

export interface SessionRecordV1 {
  schemaVersion: 1;
  gatewayHost: string;
  cookieHeader: string;
  capturedAt: string;
  lastConfirmedAt: string | null;
  /** Absolute ticket expiry. `null` means the ticket was seen without Expires/Max-Age. */
  expiresAt: string | null;
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
    (record.expiresAt !== undefined && record.expiresAt !== null && typeof record.expiresAt !== "string") ||
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
      expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
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
      expiresAt: null,
      status: "captured",
    },
  };
}

/** Newer gateway cookie replaces the stored header. A valid session stays valid.
 * The ticket clock is kept when the ticket value did not change. */
export function applyNewerCookie(current: SessionRecordV1, captured: SessionRecordV1): SessionRecordV1 {
  if (current.gatewayHost !== captured.gatewayHost) {
    return captured;
  }
  if (current.cookieHeader === captured.cookieHeader) {
    return current;
  }
  const sameTicket = cookiePairValue(current.cookieHeader, TICKET_COOKIE_NAME) === cookiePairValue(captured.cookieHeader, TICKET_COOKIE_NAME);
  return {
    ...captured,
    expiresAt: sameTicket ? captured.expiresAt ?? current.expiresAt : captured.expiresAt,
    status: current.status === "valid" ? "valid" : "captured",
    lastConfirmedAt: current.status === "valid" ? current.lastConfirmedAt : null,
  };
}

export type TicketLifetime =
  | { kind: "expires"; expiresAt: string; value: string }
  | { kind: "unknown"; value: string }
  | { kind: "expired" }
  | { kind: "absent" };

export type TicketSetCookieResult =
  | { kind: "absent" }
  | { kind: "expired" }
  | { kind: "update"; session: SessionRecordV1 };

/** Local clock only. A missing `expiresAt` is not expiry. */
export function sessionExpiredByClock(session: SessionRecordV1, nowIso: string): boolean {
  if (!session.expiresAt) return false;
  const expires = Date.parse(session.expiresAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(expires) || !Number.isFinite(now)) return false;
  return now >= expires;
}

/** Read the session ticket from a gateway `Set-Cookie` header. `Max-Age` wins over `Expires`. */
export function ticketLifetimeFromSetCookie(raw: string, nowIso: string): TicketLifetime {
  const now = Date.parse(nowIso);
  for (const line of raw.split("\n")) {
    const parsed = parseSetCookieLine(line);
    if (!parsed || parsed.name !== TICKET_COOKIE_NAME) continue;
    if (!parsed.value) return { kind: "expired" };
    const maxAge = parsed.attrs.get("max-age");
    if (maxAge !== undefined) {
      const seconds = Number(maxAge);
      if (!Number.isFinite(seconds) || seconds <= 0) return { kind: "expired" };
      if (!Number.isFinite(now)) return { kind: "unknown", value: parsed.value };
      return { kind: "expires", expiresAt: new Date(now + seconds * 1000).toISOString(), value: parsed.value };
    }
    const expires = parsed.attrs.get("expires");
    if (expires) {
      const at = Date.parse(expires);
      if (!Number.isFinite(at) || !Number.isFinite(now) || at <= now) return { kind: "expired" };
      return { kind: "expires", expiresAt: new Date(at).toISOString(), value: parsed.value };
    }
    return { kind: "unknown", value: parsed.value };
  }
  return { kind: "absent" };
}

/** Apply a gateway ticket `Set-Cookie` onto the stored session. */
export function applyTicketSetCookie(
  session: SessionRecordV1 | null,
  raw: string,
  nowIso: string,
  gatewayHost: string,
): TicketSetCookieResult {
  const lifetime = ticketLifetimeFromSetCookie(raw, nowIso);
  if (lifetime.kind === "absent") return { kind: "absent" };
  if (lifetime.kind === "expired") return { kind: "expired" };
  const expiresAt = lifetime.kind === "expires" ? lifetime.expiresAt : null;
  const header = `${TICKET_COOKIE_NAME}=${lifetime.value}`;
  if (!session) {
    return {
      kind: "update",
      session: {
        schemaVersion: 1,
        gatewayHost,
        cookieHeader: header,
        capturedAt: nowIso,
        lastConfirmedAt: null,
        expiresAt,
        status: "captured",
      },
    };
  }
  return {
    kind: "update",
    session: {
      ...session,
      cookieHeader: replaceCookiePair(session.cookieHeader, TICKET_COOKIE_NAME, lifetime.value),
      expiresAt,
    },
  };
}

export function cookiePairValue(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function replaceCookiePair(header: string, name: string, value: string): string {
  const kept = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const eq = part.indexOf("=");
      return eq > 0 && part.slice(0, eq).trim() !== name;
    });
  return [...kept, `${name}=${value}`].join("; ");
}

function parseSetCookieLine(line: string): { name: string; value: string; attrs: Map<string, string> } | null {
  const parts = line.split(";");
  const first = (parts[0] ?? "").trim();
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const attrs = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const at = trimmed.indexOf("=");
    if (at === -1) attrs.set(trimmed.toLowerCase(), "");
    else attrs.set(trimmed.slice(0, at).trim().toLowerCase(), trimmed.slice(at + 1).trim());
  }
  return { name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim(), attrs };
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
