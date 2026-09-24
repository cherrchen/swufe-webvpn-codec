import { gatewayHost, WrdCodec } from "../codec/wrd-codec.ts";
import { AUTH_HOST } from "../routing/allowlist.ts";
import {
  isGatewayBootstrapHtml,
  isRewritableContentType,
  rewriteBodyText,
  rewriteLocation,
  rewriteSetCookieAttrs,
  type CookieAttributeMap,
} from "./body.ts";
import { DEFAULT_BODY_REWRITE_MAX_BYTES, type RequestRewriteContext, type RewriteSettings } from "./request.ts";

export interface ResponseDTO {
  status: number;
  headers: Record<string, string>;
  body?: string | Uint8Array;
}

export interface ResponseRewriteResult {
  response: ResponseDTO;
  changed: boolean;
  changes: Array<"location" | "set-cookie" | "body" | "promotion">;
  sessionExpired: boolean;
  warning?: "body-too-large" | "unsupported-body";
}

export function rewriteResponse(
  context: RequestRewriteContext | null,
  response: ResponseDTO,
  settings: RewriteSettings,
): ResponseRewriteResult {
  if (!context) {
    return unchanged(response, sessionExpiredFrom(response, settings));
  }
  if (context.gatewayOwned) {
    return unchanged(response, false);
  }
  const host = gatewayHost(settings.gatewayBase);
  const codec = new WrdCodec(settings.wrdKey, settings.wrdIv, host);
  const bodyBytes = responseBodyBytes(response.body);
  if (isGatewayBootstrapHtml(headerValue(response.headers, "content-type"), bodyBytes) && context.wrdUrl) {
    return {
      response: {
        status: 302,
        headers: { location: context.wrdUrl, "cache-control": "no-store" },
        body: "",
      },
      changed: true,
      changes: ["promotion"],
      sessionExpired: false,
    };
  }

  const headers = { ...response.headers };
  const changes: ResponseRewriteResult["changes"] = [];
  const location = headerValue(headers, "location");
  if (location) {
    const rewritten = rewriteLocation(location, codec, host);
    if (rewritten.changed) {
      setHeader(headers, "location", rewritten.value);
      changes.push("location");
    }
  }
  const setCookie = headerValue(headers, "set-cookie");
  if (setCookie && rewriteSetCookieHeader(headers, setCookie, context, host)) {
    changes.push("set-cookie");
  }

  let warning: ResponseRewriteResult["warning"];
  let body = response.body;
  const contentType = headerValue(headers, "content-type");
  const maxBytes = settings.bodyRewriteMaxBytes ?? DEFAULT_BODY_REWRITE_MAX_BYTES;
  if (isRewritableContentType(contentType) && bodyBytes) {
    if (bodyBytes.byteLength > maxBytes) {
      warning = "body-too-large";
    } else {
      const decoded = decodeBody(response.body);
      if (decoded === null) {
        warning = "unsupported-body";
      } else {
        const replaced = rewriteBodyText(decoded, codec, host);
        if (replaced.count > 0) {
          body = replaced.text;
          changes.push("body");
        }
      }
    }
  }

  const next = { ...response, headers, body };
  return {
    response: next,
    changed: changes.length > 0,
    changes,
    sessionExpired: sessionExpiredFrom(next, settings),
    warning,
  };
}

function unchanged(response: ResponseDTO, sessionExpired: boolean): ResponseRewriteResult {
  return { response, changed: false, changes: [], sessionExpired };
}

function sessionExpiredFrom(response: ResponseDTO, settings: RewriteSettings): boolean {
  const location = headerValue(response.headers, "location");
  if (!location) {
    return false;
  }
  try {
    const url = new URL(location, settings.gatewayBase);
    return url.hostname.toLowerCase() === AUTH_HOST;
  } catch {
    return false;
  }
}

function rewriteSetCookieHeader(
  headers: Record<string, string>,
  raw: string,
  context: RequestRewriteContext,
  webvpnHost: string,
): boolean {
  const cookies = raw.split("\n");
  let changed = false;
  const next = cookies.map((cookie) => {
    const parsed = parseSetCookie(cookie);
    if (!parsed) {
      return cookie;
    }
    const attrs: CookieAttributeMap = {
      has: (key) => parsed.attrs.has(key),
      get: (key) => parsed.attrs.get(key),
      set: (key, value) => parsed.attrs.set(key, value),
    };
    if (
      rewriteSetCookieAttrs(attrs, {
        originalHost: context.originalHost,
        webvpnHost,
        wrdPrefix: context.wrdPrefix,
      })
    ) {
      changed = true;
    }
    return serializeSetCookie(parsed.name, parsed.value, parsed.attrs);
  });
  if (changed) {
    setHeader(headers, "set-cookie", next.join("\n"));
  }
  return changed;
}

function parseSetCookie(cookie: string): { name: string; value: string; attrs: Map<string, string> } | null {
  const parts = cookie.split(";");
  const first = parts[0] ?? "";
  const eq = first.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  const attrs = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const at = trimmed.indexOf("=");
    if (at === -1) {
      attrs.set(trimmed.toLowerCase(), "");
    } else {
      attrs.set(trimmed.slice(0, at).trim().toLowerCase(), trimmed.slice(at + 1).trim());
    }
  }
  return { name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim(), attrs };
}

function serializeSetCookie(name: string, value: string, attrs: Map<string, string>): string {
  const extra = [...attrs.entries()].map(([key, attrValue]) => (attrValue ? `${key}=${attrValue}` : key));
  return [`${name}=${value}`, ...extra].join("; ");
}

function responseBodyBytes(body: string | Uint8Array | undefined): Uint8Array | null {
  if (body === undefined) {
    return null;
  }
  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }
  return body;
}

function decodeBody(body: string | Uint8Array | undefined): string | null {
  if (typeof body === "string") {
    return body;
  }
  if (!body) {
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

function headerValue(headers: Record<string, string>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return "";
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name) {
      delete headers[key];
    }
  }
  headers[name] = value;
}
