import { aesCfb128Decrypt, aesCfb128Encrypt } from "./aes-cfb128.ts";
import { CodecError, type CodecErrorCode } from "../errors.ts";

export const DEFAULT_KEY = "wrdvpnisthebest!";
export const DEFAULT_IV = "wrdvpnisthebest!";
export const DEFAULT_WEBVPN_HOST = "webvpn.swufe.edu.cn";

export interface WrdCodecOptions {
  gatewayBase: string;
  key: Uint8Array;
  iv: Uint8Array;
}

const SCHEME_RE = /^(?<scheme>https?|http|https)(?:-(?<port>\d+))?$/;

export class WrdCodec {
  readonly key: Uint8Array;
  readonly iv: Uint8Array;
  readonly webvpnHost: string;

  constructor(
    key: string | Uint8Array = DEFAULT_KEY,
    iv: string | Uint8Array = DEFAULT_IV,
    webvpnHost: string = DEFAULT_WEBVPN_HOST,
  ) {
    this.key = keyBytes(key, "INVALID_KEY");
    this.iv = keyBytes(iv, "INVALID_IV");
    this.webvpnHost = webvpnHost.replace(/\/+$/, "");
  }

  static fromOptions(options: WrdCodecOptions): WrdCodec {
    const host = gatewayHost(options.gatewayBase);
    return new WrdCodec(options.key, options.iv, host);
  }

  encryptHost(host: string): string {
    const ct = aesCfb128Encrypt(this.key, this.iv, utf8(host));
    return toHex(this.iv) + toHex(ct);
  }

  decryptHost(token: string): string {
    if (token.length < 34 || token.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(token)) {
      throw new CodecError("INVALID_TOKEN");
    }
    const iv = fromHex(token.slice(0, 32));
    const ct = fromHex(token.slice(32));
    if (!iv || !ct || iv.length !== 16) {
      throw new CodecError("INVALID_TOKEN");
    }
    const pt = aesCfb128Decrypt(this.key, iv, ct);
    const text = utf8Decode(pt).replace(/\0+$/, "");
    if (text.length === 0 || text.includes("\uFFFD")) {
      throw new CodecError("DECRYPT_FAILED");
    }
    return text;
  }

  encodeUrl(ordinaryUrl: string, webvpnBase?: string): string {
    if (/^[a-z][a-z0-9+.-]*:\/\/(?:\/|$)/i.test(ordinaryUrl)) {
      throw new CodecError("INVALID_URL");
    }
    const parsed = parseUrl(ordinaryUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new CodecError("UNSUPPORTED_SCHEME");
    }
    if (!parsed.hostname) {
      throw new CodecError("INVALID_URL");
    }
    const scheme = parsed.protocol === "https:" ? "https" : "http";
    const port = parsed.port === "" ? null : Number(parsed.port);
    const defaultPort = scheme === "https" ? 443 : 80;
    const schemeToken = port === null || port === defaultPort ? scheme : `${scheme}-${port}`;
    const token = this.encryptHost(parsed.hostname);
    const path = parsed.pathname.startsWith("/") ? parsed.pathname : `/${parsed.pathname}`;
    const base = (webvpnBase ?? `https://${this.webvpnHost}`).replace(/\/+$/, "");
    let out = `${base}/${schemeToken}/${token}${path}`;
    if (parsed.search) {
      out += parsed.search;
    }
    if (parsed.hash) {
      out += parsed.hash;
    }
    return out;
  }

  decodeUrl(webvpnUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(webvpnUrl);
    } catch {
      throw new CodecError("INVALID_URL");
    }
    const pieces = parsed.pathname.replace(/^\/+/, "").split("/");
    const schemeToken = pieces[0];
    const token = pieces[1];
    if (!schemeToken || !token) {
      throw new CodecError("INVALID_URL");
    }
    const match = SCHEME_RE.exec(schemeToken);
    if (!match?.groups?.scheme) {
      throw new CodecError("INVALID_URL");
    }
    const scheme = match.groups.scheme;
    const port = match.groups.port;
    const host = this.decryptHost(token);
    const rest = pieces.length > 2 ? `/${pieces.slice(2).join("/")}` : "/";
    const netloc = port ? `${host}:${port}` : host;
    const query = parsed.search;
    const fragment = parsed.hash;
    return `${scheme}://${netloc}${rest}${query}${fragment}`;
  }
}

export function gatewayHost(gatewayBase: string): string {
  try {
    const url = new URL(gatewayBase);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) {
      throw new CodecError("INVALID_URL");
    }
    return url.hostname;
  } catch (error) {
    if (error instanceof CodecError) {
      throw error;
    }
    throw new CodecError("INVALID_URL");
  }
}

function keyBytes(value: string | Uint8Array, code: CodecErrorCode): Uint8Array {
  const raw = typeof value === "string" ? utf8(value) : value;
  if (raw.length !== 16) {
    throw new CodecError(code);
  }
  return raw;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function utf8Decode(value: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(value);
}

function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new CodecError("INVALID_URL");
  }
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array | null {
  if (value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value)) {
    return null;
  }
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
