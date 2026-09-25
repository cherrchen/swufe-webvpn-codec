import { CodecError } from "../errors.ts";
import { gatewayHost, WrdCodec } from "../codec/wrd-codec.ts";
import { decideRoute, type RoutingPolicy } from "../routing/allowlist.ts";
import {
  captureSession,
  headerValue,
  sessionMatchesGateway,
  type SessionRecordV1,
} from "../session/session.ts";
import type { PluginErrorCode } from "../errors.ts";

export const GATEWAY_ROOT_PREFIXES = ["/wengine-vpn/", "/authserver/"] as const;
export const DEFAULT_BODY_REWRITE_MAX_BYTES = 1_048_576;

export interface RequestDTO {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | Uint8Array;
}

export interface RewriteSettings {
  gatewayBase: string;
  wrdKey: string;
  wrdIv: string;
  routing: RoutingPolicy;
  debug: boolean;
  bodyRewriteMaxBytes?: number;
  hostSchemes?: Record<string, "http" | "https">;
}

export interface RequestRewriteContext {
  originalUrl: string;
  originalHost: string;
  wrdUrl: string;
  wrdPrefix: string;
  gatewayOwned: boolean;
}

export type RequestDecision =
  | { kind: "pass" }
  | { kind: "capture_session"; session: SessionRecordV1; pass: true }
  | { kind: "login_required" }
  | { kind: "rewrite"; url: string; headers: Record<string, string>; context: RequestRewriteContext }
  | { kind: "error"; code: PluginErrorCode };

export function rewriteRequest(
  request: RequestDTO,
  settings: RewriteSettings,
  session: SessionRecordV1 | null,
  nowIso: string,
): RequestDecision {
  let parsed: URL;
  try {
    parsed = new URL(request.url);
  } catch {
    return { kind: "error", code: "REWRITE_FAILED" };
  }
  const route = decideRoute(parsed.hostname, settings.routing);
  if (route.kind === "invalid" || route.kind === "pass" || route.kind === "auth") {
    return { kind: "pass" };
  }
  if (route.kind === "gateway") {
    const captured = captureSession({
      url: request.url,
      headers: request.headers,
      nowIso,
      gatewayHost: gatewayHost(settings.gatewayBase),
    });
    if (captured.kind === "captured") {
      return { kind: "capture_session", session: captured.session, pass: true };
    }
    return { kind: "pass" };
  }

  const usable = sessionMatchesGateway(session, gatewayHost(settings.gatewayBase)) ? session : null;
  if (!usable) {
    return { kind: "login_required" };
  }

  const path = parsed.pathname || "/";
  if (GATEWAY_ROOT_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    const url = `${settings.gatewayBase.replace(/\/+$/, "")}${path}${parsed.search}${parsed.hash}`;
    return {
      kind: "rewrite",
      url,
      headers: injectCookie(request.headers, usable.cookieHeader),
      context: {
        originalUrl: request.url,
        originalHost: route.originalHost,
        wrdUrl: url,
        wrdPrefix: "",
        gatewayOwned: true,
      },
    };
  }

  let codec: WrdCodec;
  try {
    codec = new WrdCodec(settings.wrdKey, settings.wrdIv, gatewayHost(settings.gatewayBase));
  } catch (error) {
    if (error instanceof CodecError) {
      return { kind: "error", code: "CODEC_FAILED" };
    }
    return { kind: "error", code: "CODEC_FAILED" };
  }

  let wrdUrl: string;
  try {
    wrdUrl = codec.encodeUrl(urlForHostScheme(request.url, route.originalHost, settings.hostSchemes), settings.gatewayBase);
  } catch (error) {
    if (error instanceof CodecError) {
      return { kind: "error", code: "CODEC_FAILED" };
    }
    return { kind: "error", code: "CODEC_FAILED" };
  }

  const headers = injectCookie(request.headers, usable.cookieHeader);
  rewriteOrigin(headers, request.headers, route.originalHost, settings);
  rewriteReferer(headers, request.headers, settings, codec);
  return {
    kind: "rewrite",
    url: wrdUrl,
    headers,
    context: {
      originalUrl: request.url,
      originalHost: route.originalHost,
      wrdUrl,
      wrdPrefix: wrdPrefixOf(wrdUrl),
      gatewayOwned: false,
    },
  };
}

function urlForHostScheme(url: string, host: string, schemes: RewriteSettings["hostSchemes"]): string {
  if (!schemes) return url;
  const wanted = schemes[host] === "https" ? "https:" : "http:";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol === wanted) return url;
  parsed.protocol = wanted;
  return parsed.toString();
}

export function wrdPrefixOf(wrdUrl: string): string {
  const path = new URL(wrdUrl).pathname.replace(/^\/+/, "");
  const parts = path.split("/");
  return `/${parts.slice(0, 2).join("/")}`;
}

function injectCookie(headers: Record<string, string>, sessionCookie: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "cookie") {
      next[key] = value;
    }
  }
  const existing = headerValue(headers, "cookie");
  next.cookie = mergeCookies(existing, sessionCookie);
  return next;
}

export function mergeCookies(existing: string, sessionCookie: string): string {
  const sessionPairs = parseCookies(sessionCookie);
  const kept = parseCookies(existing).filter((pair) => !sessionPairs.some((item) => item.name === pair.name));
  return [...kept, ...sessionPairs].map((pair) => `${pair.name}=${pair.value}`).join("; ");
}

function parseCookies(header: string): Array<{ name: string; value: string }> {
  if (!header.trim()) {
    return [];
  }
  return header
    .split(";")
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq <= 0) {
        return null;
      }
      return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
    })
    .filter((pair): pair is { name: string; value: string } => pair !== null && pair.name.length > 0);
}

function rewriteOrigin(
  headers: Record<string, string>,
  original: Record<string, string>,
  originalHost: string,
  settings: RewriteSettings,
): void {
  const origin = headerValue(original, "origin");
  if (!origin) {
    return;
  }
  let originHost = "";
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return;
  }
  const route = decideRoute(originHost, settings.routing);
  if (originHost === originalHost || route.kind === "rewrite") {
    const base = new URL(settings.gatewayBase);
    setHeader(headers, "origin", `${base.protocol}//${base.host}`);
  }
}

function rewriteReferer(
  headers: Record<string, string>,
  original: Record<string, string>,
  settings: RewriteSettings,
  codec: WrdCodec,
): void {
  const referer = headerValue(original, "referer");
  if (!referer) {
    return;
  }
  let refererHost = "";
  try {
    refererHost = new URL(referer).hostname.toLowerCase();
  } catch {
    return;
  }
  if (decideRoute(refererHost, settings.routing).kind !== "rewrite") {
    return;
  }
  try {
    setHeader(headers, "referer", codec.encodeUrl(urlForHostScheme(referer, refererHost, settings.hostSchemes), settings.gatewayBase));
  } catch (error) {
    if (error instanceof CodecError) {
      return;
    }
    throw error;
  }
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) {
      delete headers[key];
    }
  }
  headers[name] = value;
}
