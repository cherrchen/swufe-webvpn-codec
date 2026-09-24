import { WrdCodec } from "../codec/wrd-codec.ts";

const SCHEME_TOKEN = String.raw`https?(?:-\d+)?`;
const HOST_TOKEN = String.raw`[0-9a-fA-F]{34,}`;
const SLASH = String.raw`(?:\\?/)`;
const REST = String.raw`(?:\\/|[^\s"'<>\\])*`;

export const REWRITABLE_CONTENT_TYPES = [
  "text/html",
  "application/javascript",
  "text/javascript",
  "application/json",
] as const;

export const GATEWAY_BOOTSTRAP_MARKERS = ["__vpn_", "/wengine-vpn/js/main.js"] as const;
export const GATEWAY_BOOTSTRAP_MAX_BYTES = 8192;

export function isRewritableContentType(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const type = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return (REWRITABLE_CONTENT_TYPES as readonly string[]).includes(type);
}

export function isGatewayBootstrapHtml(contentType: string | null | undefined, body: Uint8Array | null): boolean {
  if (!contentType || contentType.split(";", 1)[0]?.trim().toLowerCase() !== "text/html") {
    return false;
  }
  if (!body || body.byteLength > GATEWAY_BOOTSTRAP_MAX_BYTES) {
    return false;
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(body);
  return GATEWAY_BOOTSTRAP_MARKERS.every((marker) => text.includes(marker));
}

export function decodeWrdReference(value: string, codec: WrdCodec, webvpnHost: string): string | null {
  if (!value) {
    return null;
  }
  const match = valuePattern(webvpnHost).exec(value);
  if (!match?.groups?.path) {
    return null;
  }
  const path = match.groups.path.replace(/\\\//g, "/");
  try {
    return codec.decodeUrl(`https://${webvpnHost}${path.startsWith("/") ? path : `/${path}`}`);
  } catch {
    return null;
  }
}

export function rewriteLocation(value: string, codec: WrdCodec, webvpnHost: string): { value: string; changed: boolean } {
  const decoded = decodeWrdReference(value, codec, webvpnHost);
  if (decoded === null) {
    return { value, changed: false };
  }
  return { value: decoded, changed: true };
}

export function stripWrdPrefix(path: string, wrdPrefix: string): string | null {
  if (!wrdPrefix) {
    return null;
  }
  if (path === wrdPrefix) {
    return "/";
  }
  if (path.startsWith(`${wrdPrefix}/`)) {
    return path.slice(wrdPrefix.length);
  }
  return null;
}

export interface CookieAttributeMap {
  has(key: string): boolean;
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export function rewriteSetCookieAttrs(
  attrs: CookieAttributeMap,
  input: { originalHost: string; webvpnHost: string; wrdPrefix: string },
): boolean {
  let changed = false;
  if (attrs.has("domain")) {
    const domain = attrs.get("domain") ?? "";
    const candidate = domain.replace(/^\./, "").toLowerCase();
    if (candidate === input.webvpnHost || candidate.endsWith(`.${input.webvpnHost}`)) {
      attrs.set("domain", input.originalHost.replace(/^\./, ""));
      changed = true;
    }
  }
  if (attrs.has("path")) {
    const stripped = stripWrdPrefix(attrs.get("path") ?? "", input.wrdPrefix);
    if (stripped !== null) {
      attrs.set("path", stripped);
      changed = true;
    }
  }
  return changed;
}

export function rewriteBodyText(text: string, codec: WrdCodec, webvpnHost: string): { text: string; count: number } {
  const pattern = bodyPattern(webvpnHost);
  let count = 0;
  const replaced = text.replace(pattern, (raw, ...rest) => {
    const groups = rest.at(-1) as Record<string, string> | undefined;
    const path = groups?.path ?? "";
    const decoded = decodeWrdReference(raw, codec, webvpnHost);
    if (decoded === null) {
      return raw;
    }
    count += 1;
    if (path.includes("\\/")) {
      return decoded.replaceAll("/", "\\/");
    }
    return decoded;
  });
  return { text: replaced, count };
}

function valuePattern(webvpnHost: string): RegExp {
  return buildPattern(webvpnHost, true);
}

function bodyPattern(webvpnHost: string): RegExp {
  return buildPattern(webvpnHost, false);
}

function buildPattern(webvpnHost: string, anchored: boolean): RegExp {
  const host = escapeRegExp(webvpnHost) + String.raw`(?::\d+)?`;
  const prefix = `(?:(?:https?:)?${SLASH}${SLASH}${host})?`;
  const path = `(?<path>${SLASH}(?<scheme_token>${SCHEME_TOKEN})${SLASH}(?<token>${HOST_TOKEN})(?<rest>${REST}))`;
  const body = `${prefix}${path}`;
  return new RegExp(anchored ? `^${body}$` : body, "gi");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
