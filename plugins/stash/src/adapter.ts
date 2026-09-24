import {
  STORAGE_KEYS,
  WrdCodec,
  applyNewerCookie,
  createSessionStore,
  defaultSettings,
  gatewayHost,
  notificationFor,
  parseSession,
  parseSettings,
  promoteSession,
  rewriteRequest,
  rewriteResponse,
  safeDiagnostic,
  stashTile,
  toRewriteSettings,
  wrdPrefixOf,
  type HostAdapter,
  type HostEnvironment,
  type HostRequestResult,
  type HostResponseResult,
  type KeyValueStore,
  type NotificationDTO,
  type RequestRewriteContext,
  type SafeDiagnosticRecord,
  type SessionRecordV1,
} from "webvpn-core-js";

const NOTIFY_GAP_MS = 60_000;

export interface StashRuntime {
  nowIso: string;
  request?: { url: string; method?: string; headers?: Record<string, string>; body?: string };
  response?: { status?: number; headers?: Record<string, string>; body?: string };
  read(key: string): string | null;
  write(key: string, value: string | null): boolean;
  notify(input: NotificationDTO): void;
  debug(record: SafeDiagnosticRecord): void;
  finishRequest(result: HostRequestResult): void;
  finishResponse(result: HostResponseResult): void;
  env(): HostEnvironment;
}

export function createStashAdapter(runtime: StashRuntime): HostAdapter {
  return {
    env: () => runtime.env(),
    read: (key) => runtime.read(key),
    write: (key, value) => runtime.write(key, value),
    notify: (input) => runtime.notify(input),
    debug: (record) => runtime.debug(record),
    finishRequest: (result) => runtime.finishRequest(result),
    finishResponse: (result) => runtime.finishResponse(result),
  };
}

export function handleStashRequest(runtime: StashRuntime): void {
  const settings = loadSettings(runtime);
  if (!settings.enabled) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host: null, direction: "request", action: "pass", detail: "disabled" });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  const rewriteSettings = toRewriteSettings(settings);
  const store = createSessionStore(kv(runtime));
  const loaded = store.load();
  const compatible = loaded && sessionSchemaOk(runtime);
  const request = runtime.request;
  if (!request?.url) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host: null, direction: "request", action: "pass", detail: "missing-url" });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  const decision = rewriteRequest(
    {
      url: request.url,
      method: request.method ?? "GET",
      headers: request.headers ?? {},
      body: request.body,
    },
    rewriteSettings,
    compatible ? loaded : null,
    runtime.nowIso,
  );
  const host = safeHost(request.url);
  const detail = requestDetail(request.url, loaded ? "ready" : "missing", request.headers);
  if (decision.kind === "capture_session") {
    const next = loaded ? applyNewerCookie(loaded, decision.session) : decision.session;
    store.save(next);
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "session-captured", detail });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  if (decision.kind === "login_required") {
    notifyThrottled(runtime, "login-required");
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "error", code: "NOT_LOGGED_IN", detail });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  if (decision.kind === "error") {
    writeLastError(runtime, decision.code, host);
    notifyThrottled(runtime, decision.code === "CODEC_FAILED" ? "codec-failed" : "runtime-incompatible");
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "error", code: decision.code, detail });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  if (decision.kind === "rewrite") {
    if (loaded) {
      store.save(promoteSession(loaded, runtime.nowIso));
    }
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "rewrite", detail });
    runtime.finishRequest({ decision: "rewrite", url: decision.url, headers: decision.headers });
    return;
  }
  emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "pass", detail });
  runtime.finishRequest({ decision: "pass" });
}

export function handleStashResponse(runtime: StashRuntime): void {
  const settings = loadSettings(runtime);
  if (!settings.enabled || !runtime.request?.url || !runtime.response) {
    runtime.finishResponse({});
    return;
  }
  const rewriteSettings = toRewriteSettings(settings);
  const context = deriveRewriteContext(runtime.request.url, rewriteSettings.gatewayBase, rewriteSettings.wrdKey, rewriteSettings.wrdIv)
    ?? deriveOriginalRequestContext(runtime, rewriteSettings);
  const result = rewriteResponse(
    context,
    {
      status: runtime.response.status ?? 200,
      headers: runtime.response.headers ?? {},
      body: runtime.response.body,
    },
    rewriteSettings,
  );
  const host = context?.originalHost ?? safeHost(runtime.request.url);
  const detail = responseDetail(runtime.response);
  if (result.sessionExpired) {
    createSessionStore(kv(runtime)).clear();
    writeLastError(runtime, "SESSION_EXPIRED", host);
    notifyThrottled(runtime, "session-expired");
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "session-expired", code: "SESSION_EXPIRED", detail });
  } else if (result.warning) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "body-skipped", detail: `${result.warning} ${detail}` });
  } else if (result.changed) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "rewrite", detail });
  } else {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "pass", detail });
  }
  if (!result.changed && !result.sessionExpired) {
    runtime.finishResponse({});
    return;
  }
  runtime.finishResponse({
    status: result.response.status,
    headers: result.response.headers,
    body: typeof result.response.body === "string" || result.response.body instanceof Uint8Array ? result.response.body : undefined,
  });
}

// Stash may expose the browser URL, rather than the rewritten upstream URL, to
// a response script. Reconstruct only a request that our request script would
// have rewritten with the current session.
function deriveOriginalRequestContext(runtime: StashRuntime, settings: ReturnType<typeof toRewriteSettings>): RequestRewriteContext | null {
  const request = runtime.request;
  if (!request?.url) return null;
  const session = createSessionStore(kv(runtime)).load();
  if (!session) return null;
  const decision = rewriteRequest(
    { url: request.url, method: request.method ?? "GET", headers: request.headers ?? {} },
    settings,
    session,
    runtime.nowIso,
  );
  return decision.kind === "rewrite" ? decision.context : null;
}

export function handleStashTile(runtime: StashRuntime): { title: "SWUFE WebVPN"; content: string; url: string; icon?: string; sessionState: string } {
  const raw = runtime.read(STORAGE_KEYS.session);
  const parsed = raw ? parseSession(raw) : null;
  const last = readLastError(runtime);
  const tile = stashTile({
    sessionReady: parsed?.kind === "ok",
    expired: last === "SESSION_EXPIRED",
    incompatible: parsed?.kind === "incompatible",
  });
  return { ...tile, sessionState: parsed?.kind ?? "missing" };
}

export function deriveRewriteContext(requestUrl: string, gatewayBase: string, key: string, iv: string): RequestRewriteContext | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const gateway = gatewayHost(gatewayBase);
  if (url.hostname.toLowerCase() !== gateway) {
    return null;
  }
  const path = url.pathname;
  if (path.startsWith("/wengine-vpn/") || path.startsWith("/authserver/")) {
    return {
      originalUrl: requestUrl,
      originalHost: gateway,
      wrdUrl: requestUrl,
      wrdPrefix: "",
      gatewayOwned: true,
    };
  }
  const pieces = path.replace(/^\/+/, "").split("/");
  if (pieces.length < 2 || !/^https?(?:-\d+)?$/.test(pieces[0] ?? "")) {
    return null;
  }
  try {
    const codec = new WrdCodec(key, iv, gateway);
    const originalUrl = codec.decodeUrl(requestUrl);
    const originalHost = new URL(originalUrl).hostname;
    return {
      originalUrl,
      originalHost,
      wrdUrl: requestUrl,
      wrdPrefix: wrdPrefixOf(requestUrl),
      gatewayOwned: false,
    };
  } catch {
    return null;
  }
}

function loadSettings(runtime: StashRuntime) {
  return parseSettings(runtime.read(STORAGE_KEYS.settings));
}

function kv(runtime: StashRuntime): KeyValueStore {
  return { read: (key) => runtime.read(key), write: (key, value) => runtime.write(key, value) };
}

function sessionSchemaOk(runtime: StashRuntime): boolean {
  const raw = runtime.read(STORAGE_KEYS.session);
  if (!raw) return true;
  return parseSession(raw).kind === "ok";
}

function notifyThrottled(runtime: StashRuntime, event: NotificationDTO["event"]): void {
  const raw = runtime.read(STORAGE_KEYS.notificationThrottle);
  let last = 0;
  if (raw) {
    try {
      const data = JSON.parse(raw) as { lastByEvent?: Record<string, number> };
      last = data.lastByEvent?.[event] ?? 0;
    } catch {
      last = 0;
    }
  }
  const now = Date.parse(runtime.nowIso);
  if (Number.isFinite(now) && now - last < NOTIFY_GAP_MS) {
    return;
  }
  const note = notificationFor(event);
  runtime.notify(note);
  const next = { schemaVersion: 1, lastByEvent: { [event]: Number.isFinite(now) ? now : 0 } };
  runtime.write(STORAGE_KEYS.notificationThrottle, JSON.stringify(next));
}

function writeLastError(runtime: StashRuntime, code: string, host: string | null): void {
  runtime.write(
    STORAGE_KEYS.lastError,
    JSON.stringify({ schemaVersion: 1, code, ts: runtime.nowIso, host, detail: code === "CODEC_FAILED" ? "encode-failed" : code }),
  );
}

function readLastError(runtime: StashRuntime): string | null {
  const raw = runtime.read(STORAGE_KEYS.lastError);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { code?: string };
    return typeof data.code === "string" ? data.code : null;
  } catch {
    return null;
  }
}

function emit(runtime: StashRuntime, debug: boolean, record: SafeDiagnosticRecord): void {
  const safe = safeDiagnostic(record, debug);
  if (safe) runtime.debug(safe);
  if (record.direction === "system") return;
  const always = safeDiagnostic({ ...record, direction: "system" }, false);
  if (always) runtime.debug(always);
}

function requestDetail(url: string, session: "ready" | "missing", headers: Record<string, string> | undefined): string {
  return `path=${pathOf(url)} session=${session} cookieHeader=${cookieHeaderState(headers)}`;
}

function responseDetail(response: NonNullable<StashRuntime["response"]>): string {
  return `status=${response.status ?? 0} locationHost=${locationHost(response.headers) ?? "-"}`;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

function cookieHeaderState(headers: Record<string, string> | undefined): "present" | "absent" {
  if (!headers) return "absent";
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "cookie") {
      return String(value ?? "").trim() ? "present" : "absent";
    }
  }
  return "absent";
}

function locationHost(headers: Record<string, string> | undefined): string | null {
  if (!headers) return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "location" || !value) continue;
    try {
      return new URL(value, "https://webvpn.swufe.edu.cn").hostname;
    } catch {
      return null;
    }
  }
  return null;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export { defaultSettings };
