import {
  STORAGE_KEYS,
  GATEWAY_HOST,
  TICKET_COOKIE_NAME,
  WrdCodec,
  classifyGatewayRequest,
  decideRoute,
  applyNewerCookie,
  applyTicketSetCookie,
  captureSession,
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
const DIAGNOSTIC_TRACE_KEY = "swufe.trace.pending.v1";

export interface StashRuntime {
  nowIso: string;
  request?: { url: string; method?: string; headers?: Record<string, string>; body?: string | Uint8Array };
  response?: { status?: number; headers?: Record<string, string>; body?: string | Uint8Array };
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
  const traceId = diagnosticTrace(runtime);
  emit(runtime, settings.debug, { ts: runtime.nowIso, host: safeHost(request.url), direction: "request", action: "entered", detail: `trace=${traceId} request-enter ${requestMetadata(request)}` });
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
  const detail = `${authTraceDetail(request.url, rewriteSettings, session, request.headers, decision.kind, clockExpired)} ${requestMetadata(request)}`;
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
    const decoded = deriveRewriteContext(decision.url, rewriteSettings.gatewayBase, rewriteSettings.wrdKey, rewriteSettings.wrdIv);
    const bodyPreserved = "unknown"; // Stash's $done({url, headers}) does not expose the post-rewrite request body.
    const gwCookies = gatewayCookieNames(decision.headers);
    savePendingTrace(runtime, { traceId, method: request.method ?? "GET", host: decoded?.originalHost ?? host, path: safePath(request.url), at: runtime.nowIso });
    emit(runtime, settings.debug, { ts: runtime.nowIso, host, direction: "request", action: "rewrite", detail: `trace=${traceId} targetHost=${safeHost(decision.url) ?? "-"} targetScheme=${schemeOf(decision.url)} rewrittenPathShape=/${wrappedSchemeOf(decision.url)}/<wrd>/... decodedOriginalHost=${decoded?.originalHost ?? "-"} gatewayKind=wrapped-resource gatewayCookiePresent=${gwCookies.length ? "yes" : "no"} gatewayCookieNames=[${gwCookies.join(",")}] gatewayTicketCookiePresent=${gwCookies.some((n) => n.startsWith("wengine_vpn_ticket")) ? "yes" : "no"} routeCookiePresent=${gwCookies.includes("route") ? "yes" : "no"} requestBodyPreserved=${bodyPreserved} ${detail}` });
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
  const priorSession = createSessionStore(kv(runtime)).load();
  const ticketEvent = observeGatewayTicket(runtime, settings.gatewayBase);
  confirmGatewayRootSession(runtime, settings.gatewayBase, ticketEvent);
  const rewriteSettings = toRewriteSettingsFromV2(settings);
  const context = deriveRewriteContext(runtime.request.url, rewriteSettings.gatewayBase, rewriteSettings.wrdKey, rewriteSettings.wrdIv)
    ?? deriveOriginalRequestContext(runtime, rewriteSettings);
  const traceId = takePendingTrace(runtime, context?.originalHost ?? safeHost(runtime.request.url), safePath(context?.originalUrl ?? runtime.request.url), runtime.request.method ?? "GET") ?? diagnosticTrace(runtime);
  // After a browser navigation has reached the WebVPN URL, its bootstrap
  // document must be served as-is. Promoting it to the same URL loops forever.
  if (context && !context.gatewayOwned && isNativeGatewayUrl(runtime.request.url, rewriteSettings.gatewayBase)) {
    emit(runtime, settings.debug, {
      ts: runtime.nowIso,
      host: safeHost(runtime.request.url),
      direction: "response",
      action: "pass",
      detail: `trace=${traceId} ${responseDetail(runtime.response, runtime.request.url, runtime.request.headers, rewriteSettings, ticketEvent, priorSession)}`,
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
  const detail = `trace=${traceId} ${responseDetail(runtime.response, runtime.request.url, runtime.request.headers, rewriteSettings, ticketEvent, priorSession)}`;
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

type GatewayTicketEvent = "none" | "new" | "same" | "rotated" | "unbound-ignored" | "expired" | "expired-ignored";

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
    const requestTicket = cookiePairValue(headerValue(request.headers ?? {}, "cookie"), TICKET_COOKIE_NAME);
    const storedTicket = previous ? cookiePairValue(previous.cookieHeader, TICKET_COOKIE_NAME) : null;
    if (applied.kind === "expired") {
      // A different App can receive a ticket deletion while Safari's stored
      // ticket remains usable. Clear only when this request used that ticket.
      if (requestTicket !== null && requestTicket === storedTicket) {
        expireStoredSession(runtime, host);
        return "expired";
      }
      return "expired-ignored";
    }
    if (applied.kind === "update") {
      // A ticket minted for a no-ticket/different-ticket client must not
      // replace an existing shared session captured from another client.
      if (previous && requestTicket !== storedTicket) return "unbound-ignored";
      store.save(applied.session);
      const newTicket = cookiePairValue(applied.session.cookieHeader, TICKET_COOKIE_NAME);
      return storedTicket === null ? "new" : storedTicket === newTicket ? "same" : "rotated";
    }
  }
  return "none";
}

function confirmGatewayRootSession(runtime: StashRuntime, gatewayBase: string, ticketEvent: GatewayTicketEvent): void {
  const request = runtime.request;
  if (!request?.url || runtime.response?.status !== 200 || classifyGatewayRequest(request.url) !== "gateway-root"
    || safeHost(request.url) !== gatewayHost(gatewayBase) || ticketEvent === "expired" || ticketEvent === "expired-ignored"
    || ticketEvent === "unbound-ignored") return;
  const captured = captureSession({ url: request.url, headers: request.headers ?? {}, nowIso: runtime.nowIso, gatewayHost: gatewayHost(gatewayBase) });
  if (captured.kind !== "captured" || cookiePairValue(captured.session.cookieHeader, TICKET_COOKIE_NAME) === null) return;
  const store = createSessionStore(kv(runtime));
  const previous = store.load();
  const next = ticketEvent !== "none" && previous ? previous
    : previous && cookiePairValue(previous.cookieHeader, TICKET_COOKIE_NAME) === cookiePairValue(captured.session.cookieHeader, TICKET_COOKIE_NAME)
      ? applyNewerCookie(previous, captured.session) : captured.session;
  store.save(promoteSession(next, runtime.nowIso));
  runtime.write(STORAGE_KEYS.lastError, null);
  emit(runtime, false, { ts: runtime.nowIso, host: gatewayHost(gatewayBase), direction: "response", action: "session-captured", detail: "route=gateway gatewayKind=gateway-root sessionAction=confirm" });
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
  const sourceScheme = schemeOf(url);
  const targetScheme = route === "rewrite" ? settings.hostSchemes?.[host] ?? "http"
    : gatewayKind === "wrapped-resource" ? wrappedSchemeOf(url) : "-";
  const cookiePriority = ticket ? decision === "inject_gateway_session" || (decision === "rewrite" && route === "rewrite") ? "stored" : "request" : "not-applicable";
  return `route=${route} gatewayKind=${gatewayKind} decodedOriginalHost=${decoded?.originalHost ?? "-"} sourceScheme=${sourceScheme} targetScheme=${targetScheme} requestTicket=${ticket ? "present" : "missing"} ticketRelation=${ticketRelation} storedSession=${stored} sessionAction=${action} requestCookiePriority=${cookiePriority} serviceHost=${serviceHost ?? "-"}`;
}

function schemeOf(url: string): "http" | "https" | "other" {
  try {
    const protocol = new URL(url).protocol;
    return protocol === "http:" ? "http" : protocol === "https:" ? "https" : "other";
  } catch { return "other"; }
}

function wrappedSchemeOf(url: string): "http" | "https" | "-" {
  try {
    const first = new URL(url).pathname.split("/")[1] ?? "";
    return /^http(?:-\d+)?$/.test(first) ? "http" : /^https(?:-\d+)?$/.test(first) ? "https" : "-";
  } catch { return "-"; }
}

function serviceTargetHost(url: string): string | null {
  try {
    const service = new URL(url).searchParams.get("service");
    return service ? new URL(service).hostname : null;
  } catch { return null; }
}

function responseDetail(response: NonNullable<StashRuntime["response"]>, requestUrl: string, requestHeaders: Record<string, string> | undefined, settings: ReturnType<typeof toRewriteSettingsFromV2>, ticketEvent: GatewayTicketEvent, priorSession: SessionRecordV1 | null): string {
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
  const locationGatewaySignal = locationUrl && locationGatewayKind === "gateway-owned"
    ? gatewayOwnedSignal(locationUrl) : "-";
  const responseVisibleTicket = requestHost === gatewayHost(settings.gatewayBase)
    ? (cookiePairValue(headerValue(requestHeaders ?? {}, "cookie"), TICKET_COOKIE_NAME) !== null ? "present" : "missing")
    : "-";
  const responseTicket = requestHost === gatewayHost(settings.gatewayBase)
    ? cookiePairValue(headerValue(requestHeaders ?? {}, "cookie"), TICKET_COOKIE_NAME) : null;
  const storedTicket = priorSession ? cookiePairValue(priorSession.cookieHeader, TICKET_COOKIE_NAME) : null;
  const responseTicketRelation = requestHost !== gatewayHost(settings.gatewayBase) ? "-"
    : responseTicket === null ? "missing" : storedTicket === null ? "no-stored-ticket"
      : responseTicket === storedTicket ? "same" : "different";
  const authKind = locationHost === "authserver.swufe.edu.cn" ? "raw-authserver"
    : wrapped?.originalHost === "authserver.swufe.edu.cn" ? "wrapped-authserver" : "none";
  const cookieInfo = classifySetCookie(response.headers ?? {});
  const body = response.body;
  const bodyLength = byteLength(body);
  const contentType = header(response.headers, "content-type")?.split(";")[0]?.trim().toLowerCase() ?? "unknown";
  const bodyKind = classifyBody(contentType, body);
  const origin = classifyResponseOrigin(contentType, bodyKind, requestGatewayKind, locationHost, authKind, body);
  const status = response.status ?? 0;
  const responseClass = status >= 300 && status < 400 && authKind !== "none" ? "redirect-auth"
    : origin.kind === "gateway-auth" ? "redirect-auth"
      : origin.kind === "gateway-html" ? "gateway-html"
        : origin.kind === "upstream-api" ? "upstream-json"
          : origin.kind === "upstream-html" ? "upstream-html"
            : status >= 200 && status < 300 ? "success-http" : "unknown";
  return `status=${status} gatewayKind=${requestGatewayKind} decodedOriginalHost=${requestWrapped?.originalHost ?? "-"} targetScheme=${requestGatewayKind === "wrapped-resource" ? wrappedSchemeOf(requestUrl) : "-"} responseVisibleTicket=${responseVisibleTicket} responseTicketRelation=${responseTicketRelation} ticketSetCookie=${ticketEvent} gatewaySessionRefresh=${ticketEvent === "new" || ticketEvent === "rotated" ? "yes" : "no"} locationHost=${locationHost ?? "-"} locationGatewayKind=${locationGatewayKind} locationGatewaySignal=${locationGatewaySignal} locationAuth=${authKind} contentType=${contentType} contentLength=${header(response.headers, "content-length") ?? (bodyLength === null ? "unknown" : bodyLength)} bodyPresent=${bodyLength === null ? "unknown" : bodyLength > 0 ? "yes" : "no"} bodyLength=${bodyLength ?? "unknown"} bodyKind=${bodyKind} bodyOriginGuess=${origin.kind} bodyOriginGuessReason=${origin.reason} responseClass=${responseClass} setCookiePresent=${cookieInfo.all.length ? "yes" : "no"} setCookieNames=[${cookieInfo.all.join(",")}] gatewaySetCookieNames=[${cookieInfo.gateway.join(",")}] applicationSetCookieNames=[${cookieInfo.application.join(",")}] unknownSetCookieNames=[${cookieInfo.unknown.join(",")}] applicationSessionCandidate=${cookieInfo.application.length ? "present" : cookieInfo.unknown.length ? "unknown" : "missing"} location=${locationUrl ? "present" : "none"} serviceHost=${locationUrl ? serviceTargetHost(wrapped?.originalUrl ?? locationUrl) ?? "-" : "-"}`;
}

function requestMetadata(request: NonNullable<StashRuntime["request"]>): string {
  const method = (request.method ?? "GET").toUpperCase();
  const length = byteLength(request.body);
  const ua = header(request.headers, "user-agent") ?? "";
  const uaClass = /sciyardapp/i.test(ua) ? "SciyardApp" : /safari/i.test(ua) ? "Safari" : /webview|wv\)/i.test(ua) ? "WebView" : ua ? "other" : "unknown";
  return `method=${method} originalHost=${safeHost(request.url) ?? "-"} originalPath=${safePath(request.url)} originalScheme=${schemeOf(request.url)} contentType=${header(request.headers, "content-type")?.split(";")[0]?.trim().toLowerCase() ?? "unknown"} contentLengthHeader=${header(request.headers, "content-length") ?? "unknown"} bodyPresent=${length === null ? "unknown" : length > 0 ? "yes" : "no"} bodyLength=${length ?? "unknown"} bodyHash=unavailable userAgentClass=${uaClass} requestCookieNames=[${cookieNames(request.headers).join(",")}]`;
}

function classifyBody(contentType: string, body: string | Uint8Array | undefined): string {
  if (!body || byteLength(body) === 0) return "empty";
  if (contentType.includes("json")) return "json";
  const text = typeof body === "string" ? body.trimStart().slice(0, 256).toLowerCase() : "";
  if (contentType === "text/html" || text.startsWith("<!doctype") || text.startsWith("<html")) return "html";
  if (contentType.startsWith("text/")) return "text";
  return typeof body === "string" ? "text" : "binary";
}

function classifyResponseOrigin(contentType: string, bodyKind: string, gatewayKind: string, locationHost: string | null, authKind: string, body: string | Uint8Array | undefined): { kind: string; reason: string } {
  const text = typeof body === "string" ? body.slice(0, 8192).toLowerCase() : "";
  if (authKind !== "none" || locationHost === "authserver.swufe.edu.cn") return { kind: "gateway-auth", reason: "auth-location" };
  if (bodyKind === "html" && /(webvpn|wengine-vpn|authserver)/i.test(text)) return { kind: "gateway-html", reason: "content-type-html+webvpn-marker" };
  if (bodyKind === "html") return { kind: gatewayKind === "wrapped-resource" ? "upstream-html" : "unknown", reason: "content-type-html" };
  if (bodyKind === "json" && gatewayKind === "wrapped-resource") return { kind: "upstream-api", reason: "content-type-json" };
  return { kind: "unknown", reason: contentType === "unknown" ? "content-type-missing" : "insufficient-signals" };
}

function classifySetCookie(headers: Record<string, string>): { all: string[]; gateway: string[]; application: string[]; unknown: string[] } {
  const raw = Object.entries(headers).find(([key]) => key.toLowerCase() === "set-cookie")?.[1];
  const all = raw ? raw.split(/,(?=\s*[^;,=\s]+\s*=)/).map((part) => part.trim().split("=", 1)[0]?.trim()).filter((name): name is string => !!name) : [];
  const gateway = all.filter((name) => /^(route|refresh|heartbeat|show_faq|show_vpn|wengine_vpn_ticket)/i.test(name));
  const knownApp = /^(jsessionid|session|phpsessid|asp\.net_sessionid)$/i;
  const application = all.filter((name) => !gateway.includes(name) && knownApp.test(name));
  const unknown = all.filter((name) => !gateway.includes(name) && !application.includes(name));
  return { all, gateway, application, unknown };
}

function cookieNames(headers: Record<string, string> | undefined): string[] {
  const raw = header(headers, "cookie") ?? "";
  return raw.split(";").map((part) => part.trim().split("=", 1)[0]?.trim()).filter((name): name is string => !!name);
}

function gatewayCookieNames(headers: Record<string, string> | undefined): string[] {
  return cookieNames(headers).filter((name) => /^(route|refresh|heartbeat|show_faq|show_vpn|wengine_vpn_ticket)/i.test(name));
}

function byteLength(body: string | Uint8Array | undefined): number | null {
  if (body === undefined) return null;
  if (body instanceof Uint8Array) return body.byteLength;
  return new TextEncoder().encode(body).byteLength;
}

function safePath(url: string): string {
  try { return new URL(url).pathname; } catch { return "-"; }
}

function diagnosticTrace(runtime: StashRuntime): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  try { if (cryptoObj?.randomUUID) return cryptoObj.randomUUID().replace(/-/g, "").slice(0, 12); } catch { /* runtime may not expose crypto */ }
  return `${Date.parse(runtime.nowIso).toString(36)}${Math.random().toString(36).slice(2, 7)}`.slice(-12);
}

function savePendingTrace(runtime: StashRuntime, pending: { traceId: string; method: string; host: string | null; path: string; at: string }): void {
  runtime.write(DIAGNOSTIC_TRACE_KEY, JSON.stringify(pending));
}

function takePendingTrace(runtime: StashRuntime, host: string | null, path: string, method: string): string | null {
  const raw = runtime.read(DIAGNOSTIC_TRACE_KEY);
  runtime.write(DIAGNOSTIC_TRACE_KEY, null);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as { traceId?: string; method?: string; host?: string | null; path?: string; at?: string };
    if (pending.host === host && pending.path === path && pending.method === method
      && Date.parse(runtime.nowIso) - Date.parse(pending.at ?? "") < 120_000) return pending.traceId ?? null;
  } catch { /* ignore corrupt transient trace */ }
  return null;
}

function gatewayOwnedSignal(url: string): "failed" | "other" {
  try { return new URL(url).pathname === "/wengine-vpn/failed" ? "failed" : "other"; }
  catch { return "other"; }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
