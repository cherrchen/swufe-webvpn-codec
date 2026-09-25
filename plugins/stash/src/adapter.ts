import {
  STORAGE_KEYS,
  GATEWAY_HOST,
  TICKET_COOKIE_NAME,
  WrdCodec,
  classifyGatewayRequest,
  decideRoute,
  applyNewerCookie,
  applyTicketSetCookie,
  cookiePairValue,
  createSessionStore,
  gatewayHost,
  handleSettingsRequest,
  headerValue,
  isSettingsNamespaceUrl,
  loadSettingsV2,
  notificationFor,
  parseSession,
  promoteSession,
  rewriteRequest,
  rewriteResponse,
  sessionExpiredByClock,
  safeDiagnostic,
  settingsErrorResponse,
  stashTile,
  toRewriteSettingsFromV2,
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
import { SETTINGS_PAGE_HTML } from "./settings-page.ts";

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
  if (runtime.request?.url && isSettingsNamespaceUrl(runtime.request.url)) {
    try {
      const response = handleSettingsRequest(settingsDto(runtime), {
        kv: kv(runtime),
        statusProvider: { getStatus: () => sessionStatus(runtime) },
        pageHtml: SETTINGS_PAGE_HTML,
      });
      runtime.finishRequest({ decision: "respond", response });
    } catch {
      runtime.finishRequest({ decision: "respond", response: settingsErrorResponse(500, "STORAGE_FAILED") });
    }
    return;
  }
  if (isGatewayLogoutUrl(runtime.request?.url)) {
    clearGatewaySessionForLogout(runtime, "request");
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  const loaded = loadSettingsV2(kv(runtime));
  if (loaded.kind === "incompatible") {
    notifyThrottled(runtime, "runtime-incompatible");
    emit(runtime, false, { ts: runtime.nowIso, host: safeHost(runtime.request?.url ?? ""), direction: "request", action: "error", code: "RUNTIME_INCOMPATIBLE" });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  const settings = loaded.settings;
  if (!settings.enabled) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host: null, direction: "request", action: "pass", detail: "disabled" });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  const rewriteSettings = toRewriteSettingsFromV2(settings);
  const store = createSessionStore(kv(runtime));
  let session = store.load();
  let clockExpired = false;
  if (session && sessionExpiredByClock(session, runtime.nowIso)) {
    const host = safeHost(runtime.request?.url ?? "");
    store.clear();
    writeLastError(runtime, "SESSION_EXPIRED", host);
    notifyThrottled(runtime, "session-expired");
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "session-expired", code: "SESSION_EXPIRED", detail: "ticket-clock" });
    session = null;
    clockExpired = true;
  }
  const compatible = session && sessionSchemaOk(runtime);
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
    compatible ? session : null,
    runtime.nowIso,
  );
  const host = safeHost(request.url);
  const detail = authTraceDetail(request.url, rewriteSettings, session, request.headers, decision.kind, clockExpired);
  if (decision.kind === "capture_session") {
    const next = session ? applyNewerCookie(session, decision.session) : decision.session;
    store.save(next);
    runtime.write(STORAGE_KEYS.lastError, null);
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "session-captured", detail });
    runtime.finishRequest({ decision: "pass" });
    return;
  }
  if (decision.kind === "login_required") {
    if (!clockExpired) {
      notifyThrottled(runtime, "login-required");
      emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "error", code: "NOT_LOGGED_IN", detail });
    }
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
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "rewrite", detail });
    runtime.finishRequest({ decision: "rewrite", url: decision.url, headers: decision.headers });
    return;
  }
  if (decision.kind === "inject_gateway_session") {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "rewrite", detail });
    runtime.finishRequest({ decision: "rewrite_headers", headers: decision.headers });
    return;
  }
  emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "pass", detail });
  runtime.finishRequest({ decision: "pass" });
}

export function handleStashResponse(runtime: StashRuntime): void {
  if (runtime.request?.url && isSettingsNamespaceUrl(runtime.request.url)) {
    runtime.finishResponse({});
    return;
  }
  if (isGatewayLogoutUrl(runtime.request?.url)) {
    clearGatewaySessionForLogout(runtime, "response");
    runtime.finishResponse({});
    return;
  }
  const loaded = loadSettingsV2(kv(runtime));
  if (loaded.kind !== "ready" && loaded.kind !== "fail-closed") {
    runtime.finishResponse({});
    return;
  }
  const settings = loaded.settings;
  if (!settings.enabled || !runtime.request?.url || !runtime.response) {
    runtime.finishResponse({});
    return;
  }
  const ticketEvent = observeGatewayTicket(runtime, settings.gatewayBase);
  const rewriteSettings = toRewriteSettingsFromV2(settings);
  const context = deriveRewriteContext(runtime.request.url, rewriteSettings.gatewayBase, rewriteSettings.wrdKey, rewriteSettings.wrdIv)
    ?? deriveOriginalRequestContext(runtime, rewriteSettings);
  // After a browser navigation has reached the WebVPN URL, its bootstrap
  // document must be served as-is. Promoting it to the same URL loops forever.
  if (context && !context.gatewayOwned && isNativeGatewayUrl(runtime.request.url, rewriteSettings.gatewayBase)) {
    emit(runtime, settings.debug, {
      ts: runtime.nowIso,
      host: safeHost(runtime.request.url),
      direction: "response",
      action: "pass",
      detail: responseDetail(runtime.response, runtime.request.url, rewriteSettings, ticketEvent),
    });
    runtime.finishResponse({});
    return;
  }
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
  const detail = responseDetail(runtime.response, runtime.request.url, rewriteSettings, ticketEvent);
  const store = createSessionStore(kv(runtime));
  const session = store.load();
  const confirmedExpiry = result.sessionExpired && session?.status === "valid";
  if (confirmedExpiry) {
    store.clear();
    writeLastError(runtime, "SESSION_EXPIRED", host);
    notifyThrottled(runtime, "session-expired");
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "session-expired", code: "SESSION_EXPIRED", detail });
  } else if (result.sessionExpired) {
    // A first visit to jwxt normally redirects through CAS. The gateway
    // Cookie was captured, but no successful jwxt response has confirmed it.
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "pass", detail: `initial-auth-redirect ${detail}` });
  } else if (result.warning) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "body-skipped", detail: `${result.warning} ${detail}` });
  } else if (result.changed && !locationTargetsRequest(runtime.request.url, result.response.headers)) {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "rewrite", detail });
  } else {
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "response", action: "pass", detail });
  }
  if (context && !context.gatewayOwned && !result.sessionExpired && !result.changes.includes("promotion")
    && result.response.status >= 200 && result.response.status < 300 && session?.status === "captured") {
    store.save(promoteSession(session, runtime.nowIso));
  }
  if (!result.changed || locationTargetsRequest(runtime.request.url, result.response.headers)) {
    runtime.finishResponse({});
    return;
  }
  runtime.finishResponse({
    status: result.response.status,
    headers: result.response.headers,
    body: typeof result.response.body === "string" || result.response.body instanceof Uint8Array ? result.response.body : undefined,
  });
}

function isGatewayLogoutUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === GATEWAY_HOST && classifyGatewayRequest(url) === "logout";
  } catch { return false; }
}

function clearGatewaySessionForLogout(runtime: StashRuntime, direction: "request" | "response"): void {
  createSessionStore(kv(runtime)).clear();
  runtime.write(STORAGE_KEYS.lastError, null);
  emit(runtime, false, { ts: runtime.nowIso, host: GATEWAY_HOST, direction, action: "pass", detail: "route=gateway gatewayKind=logout sessionAction=clear" });
}

function isNativeGatewayUrl(requestUrl: string, gatewayBase: string): boolean {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return false;
  }
  if (url.hostname.toLowerCase() !== gatewayHost(gatewayBase)) return false;
  const scheme = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  return /^https?(?:-\d+)?$/.test(scheme);
}

function locationTargetsRequest(requestUrl: string, headers: Record<string, string> | undefined): boolean {
  if (!headers) return false;
  const location = Object.entries(headers).find(([key]) => key.toLowerCase() === "location")?.[1];
  if (!location) return false;
  try {
    return new URL(location, requestUrl).href === new URL(requestUrl).href;
  } catch {
    return false;
  }
}

export function nativeGatewayRedirect(request: StashRuntime["request"], result: HostRequestResult): string | null {
  if (result.decision !== "rewrite" || !result.url || !request?.url) return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || (request.method ?? "GET").toUpperCase() !== "GET") return null;
  const accept = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === "accept")?.[1] ?? "";
  return url.pathname === "/" || accept.toLowerCase().includes("text/html") ? result.url : null;
}

// Stash may expose the browser URL, rather than the rewritten upstream URL, to
// a response script. Reconstruct only a request that our request script would
// have rewritten with the current session.
function deriveOriginalRequestContext(runtime: StashRuntime, settings: ReturnType<typeof toRewriteSettingsFromV2>): RequestRewriteContext | null {
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
  const clockExpired = parsed?.kind === "ok" && sessionExpiredByClock(parsed.session, runtime.nowIso);
  const tile = stashTile({
    sessionReady: parsed?.kind === "ok",
    expired: last === "SESSION_EXPIRED" || clockExpired,
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

function settingsDto(runtime: StashRuntime) {
  const request = runtime.request;
  let path = "/";
  try {
    path = request?.url ? new URL(request.url).pathname : "/";
  } catch {
    path = "/";
  }
  return {
    method: request?.method ?? "GET",
    path,
    nowIso: runtime.nowIso,
    origin: header(request?.headers, "origin"),
    referer: header(request?.headers, "referer"),
    contentType: header(request?.headers, "content-type"),
    token: header(request?.headers, "x-swufe-settings-token"),
    freshNonce: secureNonce() ?? undefined,
    body: request?.body,
  };
}

function secureNonce(): string | null {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) return null;
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function header(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1];
}

function sessionStatus(runtime: StashRuntime): "logged-in" | "logged-out" | "expired" | "incompatible" {
  const raw = runtime.read(STORAGE_KEYS.session);
  if (!raw) return readLastError(runtime) === "SESSION_EXPIRED" ? "expired" : "logged-out";
  const parsed = parseSession(raw);
  if (parsed.kind === "incompatible") return "incompatible";
  if (parsed.kind !== "ok") return "logged-out";
  if (sessionExpiredByClock(parsed.session, runtime.nowIso) || readLastError(runtime) === "SESSION_EXPIRED") return "expired";
  return "logged-in";
}

type GatewayTicketEvent = "none" | "new" | "same" | "rotated" | "expired";

function observeGatewayTicket(runtime: StashRuntime, gatewayBase: string): GatewayTicketEvent {
  const request = runtime.request;
  const response = runtime.response;
  if (!request?.url || !response) return "none";
  let host = "";
  try {
    host = new URL(request.url).hostname;
  } catch {
    return "none";
  }
  const gateway = gatewayHost(gatewayBase);
  if (host.toLowerCase() !== gateway) return "none";
  const store = createSessionStore(kv(runtime));
  const setCookie = headerValue(response.headers ?? {}, "set-cookie");
  if (setCookie) {
    const previous = store.load();
    const applied = applyTicketSetCookie(previous, setCookie, runtime.nowIso, gateway);
    if (applied.kind === "expired") {
      expireStoredSession(runtime, host);
      return "expired";
    }
    if (applied.kind === "update") {
      store.save(applied.session);
      const oldTicket = previous ? cookiePairValue(previous.cookieHeader, TICKET_COOKIE_NAME) : null;
      const newTicket = cookiePairValue(applied.session.cookieHeader, TICKET_COOKIE_NAME);
      return oldTicket === null ? "new" : oldTicket === newTicket ? "same" : "rotated";
    }
  }
  return "none";
}

function expireStoredSession(runtime: StashRuntime, host: string): void {
  createSessionStore(kv(runtime)).clear();
  writeLastError(runtime, "SESSION_EXPIRED", host);
  notifyThrottled(runtime, "session-expired");
  emit(runtime, false, { ts: runtime.nowIso, host, direction: "response", action: "session-expired", code: "SESSION_EXPIRED", detail: "ticket" });
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

function authTraceDetail(
  url: string,
  settings: ReturnType<typeof toRewriteSettingsFromV2>,
  session: SessionRecordV1 | null,
  headers: Record<string, string> | undefined,
  decision: string,
  clockExpired: boolean,
): string {
  const host = safeHost(url) ?? "invalid";
  const route = decideRoute(host, settings.routing).kind;
  const gatewayKind = route === "gateway" ? classifyGatewayRequest(url) : "-";
  const decoded = route === "gateway" ? deriveRewriteContext(url, settings.gatewayBase, settings.wrdKey, settings.wrdIv) : null;
  const requestTicket = cookiePairValue(headerValue(headers ?? {}, "cookie"), TICKET_COOKIE_NAME);
  const storedTicket = session ? cookiePairValue(session.cookieHeader, TICKET_COOKIE_NAME) : null;
  const ticket = requestTicket !== null;
  const ticketRelation = !ticket ? "missing" : storedTicket === null ? "no-stored-ticket" : requestTicket === storedTicket ? "same" : "different";
  const stored = clockExpired ? "expired" : session?.status ?? "missing";
  const action = decision === "inject_gateway_session" ? "inject" : decision === "capture_session" ? "capture" : "none";
  const serviceHost = serviceTargetHost(decoded?.originalUrl ?? url);
  return `route=${route} gatewayKind=${gatewayKind} decodedOriginalHost=${decoded?.originalHost ?? "-"} requestTicket=${ticket ? "present" : "missing"} ticketRelation=${ticketRelation} storedSession=${stored} sessionAction=${action} requestCookiePriority=${ticket ? "yes" : "not-applicable"} serviceHost=${serviceHost ?? "-"}`;
}

function serviceTargetHost(url: string): string | null {
  try {
    const service = new URL(url).searchParams.get("service");
    return service ? new URL(service).hostname : null;
  } catch { return null; }
}

function responseDetail(response: NonNullable<StashRuntime["response"]>, requestUrl: string, settings: ReturnType<typeof toRewriteSettingsFromV2>, ticketEvent: GatewayTicketEvent): string {
  const rawLocation = headerValue(response.headers ?? {}, "location");
  let locationUrl: string | null = null;
  try { if (rawLocation) locationUrl = new URL(rawLocation, requestUrl).href; } catch { /* omit malformed target */ }
  const locationHost = locationUrl ? safeHost(locationUrl) : null;
  const wrapped = locationUrl && locationHost === gatewayHost(settings.gatewayBase)
    ? deriveRewriteContext(locationUrl, settings.gatewayBase, settings.wrdKey, settings.wrdIv) : null;
  const requestHost = safeHost(requestUrl);
  const requestGatewayKind = requestHost === gatewayHost(settings.gatewayBase) ? classifyGatewayRequest(requestUrl) : "-";
  const requestWrapped = requestGatewayKind === "wrapped-resource"
    ? deriveRewriteContext(requestUrl, settings.gatewayBase, settings.wrdKey, settings.wrdIv) : null;
  const locationGatewayKind = locationUrl && locationHost === gatewayHost(settings.gatewayBase)
    ? classifyGatewayRequest(locationUrl) : "-";
  const authKind = locationHost === "authserver.swufe.edu.cn" ? "raw-authserver"
    : wrapped?.originalHost === "authserver.swufe.edu.cn" ? "wrapped-authserver" : "none";
  return `status=${response.status ?? 0} gatewayKind=${requestGatewayKind} decodedOriginalHost=${requestWrapped?.originalHost ?? "-"} ticketSetCookie=${ticketEvent} locationHost=${locationHost ?? "-"} locationGatewayKind=${locationGatewayKind} locationAuth=${authKind} serviceHost=${locationUrl ? serviceTargetHost(wrapped?.originalUrl ?? locationUrl) ?? "-" : "-"}`;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
