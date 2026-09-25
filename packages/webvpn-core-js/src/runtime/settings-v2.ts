import { DEFAULT_IV, DEFAULT_KEY, gatewayHost } from "../codec/wrd-codec.ts";
import { DEFAULT_BODY_REWRITE_MAX_BYTES, type RewriteSettings } from "../rewrite/request.ts";
import {
  AUTH_HOST,
  defaultRoutingPolicy,
  EXCLUDED_HOSTS,
  GATEWAY_HOST,
  normalizeHost,
  type RoutingPolicy,
} from "../routing/allowlist.ts";
import { STORAGE_KEYS, type KeyValueStore } from "../session/session.ts";
import { parseSettings, type PluginSettingsV1 } from "./settings.ts";

export const SETTINGS_ORIGIN = "https://webvpn.swufe.edu.cn";
export const SETTINGS_PAGE_URL = "https://webvpn.swufe.edu.cn/__swufe_bridge__/";
export const SETTINGS_PREFIX = "/__swufe_bridge__";
export const SETTINGS_BODY_MAX_BYTES = 16 * 1024;
export const SETTINGS_NONCE_TTL_MS = 120_000;
export const MIGRATION_WARNING = "DROPPED_INVALID_OR_OUT_OF_SCOPE_HOST" as const;

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const NONCE_RE = /^[0-9a-f]{32,}$/;

export interface BuiltinSite {
  id: string;
  name: string;
  host: string;
}

export const BUILTIN_SITES: readonly BuiltinSite[] = [
  { id: "jwxt", name: "教务系统", host: "jwxt.swufe.edu.cn" },
];

export interface SettingsV2 {
  schemaVersion: 2;
  enabled: boolean;
  gatewayBase: string;
  builtinSiteStates: Record<string, boolean>;
  customHosts: string[];
  debug: boolean;
  wrdKeyOverride?: string;
  wrdIvOverride?: string;
  bodyRewriteMaxBytes: number;
  migrationWarnings?: Array<typeof MIGRATION_WARNING>;
}

export interface SettingsPublicDTO {
  schemaVersion: 2;
  builtinSiteStates: Record<string, boolean>;
  customHosts: string[];
}

export interface SettingsPageDTO {
  settings: SettingsPublicDTO;
  status: "logged-in" | "logged-out" | "expired" | "incompatible";
  enabledSiteCount: number;
  migrationWarnings?: Array<typeof MIGRATION_WARNING>;
}

export interface SessionStatusProvider {
  getStatus(): SettingsPageDTO["status"];
}

export type SettingsValidationCode =
  | "INVALID_JSON"
  | "INVALID_DOMAIN"
  | "RESERVED_HOST"
  | "DUPLICATE_HOST"
  | "BODY_TOO_LARGE"
  | "UNAUTHORIZED"
  | "INVALID_SETTINGS";

export type SettingsValidationResult<T> =
  | { ok: true; value: T; normalizedHosts: string[] }
  | { ok: false; code: SettingsValidationCode };

export interface SettingsRequestDTO {
  method: string;
  path: string;
  nowIso: string;
  origin?: string;
  referer?: string;
  contentType?: string;
  token?: string;
  freshNonce?: string;
  body?: string | Uint8Array;
}

export interface SettingsHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type SettingsRouteDecision =
  | { kind: "settings-page" }
  | { kind: "settings-get" }
  | { kind: "settings-post" }
  | { kind: "settings-not-found" }
  | { kind: "settings-method-not-allowed" }
  | { kind: "business-request" };

export type LoadedSettings =
  | { kind: "ready"; settings: SettingsV2 }
  | { kind: "fail-closed"; settings: SettingsV2 }
  | { kind: "incompatible" };

export function defaultSettingsV2(): SettingsV2 {
  return {
    schemaVersion: 2,
    enabled: true,
    gatewayBase: SETTINGS_ORIGIN,
    builtinSiteStates: { jwxt: true },
    customHosts: [],
    debug: false,
    bodyRewriteMaxBytes: DEFAULT_BODY_REWRITE_MAX_BYTES,
    migrationWarnings: [],
  };
}

export function validateSettingsHostname(input: string): SettingsValidationResult<string> {
  if (typeof input !== "string") {
    return { ok: false, code: "INVALID_DOMAIN" };
  }
  const trimmed = input.trim();
  if (!trimmed || /[\s/?#@:*]|:\\?\/\//.test(trimmed) || trimmed.includes(":")) {
    return { ok: false, code: "INVALID_DOMAIN" };
  }
  let candidate = trimmed.toLowerCase().replace(/\.+$/, "");
  if (!candidate || candidate === "localhost" || IPV4.test(candidate)) {
    return { ok: false, code: "INVALID_DOMAIN" };
  }
  try {
    candidate = normalizeHost(candidate);
  } catch {
    return { ok: false, code: "INVALID_DOMAIN" };
  }
  if (candidate === GATEWAY_HOST || candidate === AUTH_HOST) {
    return { ok: false, code: "RESERVED_HOST" };
  }
  if (candidate === "swufe.edu.cn" || !candidate.endsWith(".swufe.edu.cn")) {
    return { ok: false, code: "INVALID_DOMAIN" };
  }
  return { ok: true, value: candidate, normalizedHosts: [candidate] };
}

export function compileRoutingPolicy(settings: SettingsV2): RoutingPolicy {
  const exactHosts: string[] = [];
  for (const site of BUILTIN_SITES) {
    if (settings.builtinSiteStates[site.id] !== true) continue;
    const checked = validateSettingsHostname(site.host);
    if (checked.ok && !exactHosts.includes(checked.value)) exactHosts.push(checked.value);
  }
  for (const host of settings.customHosts) {
    const checked = validateSettingsHostname(host);
    if (checked.ok && !exactHosts.includes(checked.value)) exactHosts.push(checked.value);
  }
  return {
    ...defaultRoutingPolicy(),
    exactHosts,
    includeSwufeWildcard: false,
    excludedHosts: [...EXCLUDED_HOSTS],
  };
}

export function toRewriteSettingsFromV2(settings: SettingsV2): RewriteSettings {
  return {
    gatewayBase: settings.gatewayBase,
    wrdKey: settings.wrdKeyOverride ?? DEFAULT_KEY,
    wrdIv: settings.wrdIvOverride ?? DEFAULT_IV,
    routing: compileRoutingPolicy(settings),
    debug: settings.debug,
    bodyRewriteMaxBytes: settings.bodyRewriteMaxBytes,
  };
}

export function migrateV1ToV2(v1: PluginSettingsV1): SettingsV2 {
  const builtinSiteStates: Record<string, boolean> = {};
  for (const site of BUILTIN_SITES) builtinSiteStates[site.id] = false;
  const customHosts: string[] = [];
  let dropped = v1.includeSwufeWildcard === true;
  for (const raw of v1.exactHosts) {
    const checked = validateSettingsHostname(raw);
    if (!checked.ok) {
      dropped = true;
      continue;
    }
    const builtin = BUILTIN_SITES.find((site) => site.host === checked.value);
    if (builtin) {
      builtinSiteStates[builtin.id] = true;
      continue;
    }
    if (!customHosts.includes(checked.value)) customHosts.push(checked.value);
  }
  return {
    schemaVersion: 2,
    enabled: v1.enabled,
    gatewayBase: v1.gatewayBase,
    builtinSiteStates,
    customHosts,
    debug: v1.debug,
    ...(v1.wrdKeyOverride ? { wrdKeyOverride: v1.wrdKeyOverride } : {}),
    ...(v1.wrdIvOverride ? { wrdIvOverride: v1.wrdIvOverride } : {}),
    bodyRewriteMaxBytes: v1.bodyRewriteMaxBytes,
    migrationWarnings: dropped ? [MIGRATION_WARNING] : [],
  };
}

export function loadSettingsV2(kv: KeyValueStore): LoadedSettings {
  const rawV2 = kv.read(STORAGE_KEYS.settingsV2);
  if (rawV2) {
    const parsed = parseStoredV2(rawV2);
    if (parsed === "incompatible") return { kind: "incompatible" };
    if (parsed) return { kind: "ready", settings: parsed };
    return { kind: "fail-closed", settings: defaultSettingsV2() };
  }
  const rawV1 = kv.read(STORAGE_KEYS.settings);
  if (rawV1) {
    const v1 = readMigratableV1(rawV1);
    if (!v1) return { kind: "fail-closed", settings: defaultSettingsV2() };
    return persistOrFailClosed(kv, migrateV1ToV2(v1));
  }
  return persistOrFailClosed(kv, defaultSettingsV2());
}

export function toPublicSettings(settings: SettingsV2): SettingsPublicDTO {
  const builtinSiteStates: Record<string, boolean> = {};
  for (const site of BUILTIN_SITES) builtinSiteStates[site.id] = settings.builtinSiteStates[site.id] === true;
  return { schemaVersion: 2, builtinSiteStates, customHosts: [...settings.customHosts] };
}

export function pageFromSettings(settings: SettingsV2, status: SettingsPageDTO["status"]): SettingsPageDTO {
  const settingsDto = toPublicSettings(settings);
  const enabledSiteCount = Object.values(settingsDto.builtinSiteStates).filter(Boolean).length + settingsDto.customHosts.length;
  const page: SettingsPageDTO = { settings: settingsDto, status, enabledSiteCount };
  if (settings.migrationWarnings?.includes(MIGRATION_WARNING)) page.migrationWarnings = [MIGRATION_WARNING];
  return page;
}

export function validateSettingsUpdate(input: unknown, catalogHosts: string[]): SettingsValidationResult<SettingsPublicDTO> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "INVALID_SETTINGS" };
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== 2 || !record.builtinSiteStates || typeof record.builtinSiteStates !== "object" || Array.isArray(record.builtinSiteStates)) {
    return { ok: false, code: "INVALID_SETTINGS" };
  }
  if (!Array.isArray(record.customHosts)) return { ok: false, code: "INVALID_SETTINGS" };
  const states = record.builtinSiteStates as Record<string, unknown>;
  const known = new Set(BUILTIN_SITES.map((site) => site.id));
  const keys = Object.keys(states);
  if (keys.length !== known.size || keys.some((key) => !known.has(key) || typeof states[key] !== "boolean")) {
    return { ok: false, code: "INVALID_SETTINGS" };
  }
  const builtinSiteStates: Record<string, boolean> = {};
  for (const site of BUILTIN_SITES) builtinSiteStates[site.id] = states[site.id] === true;
  const customHosts: string[] = [];
  for (const item of record.customHosts) {
    if (typeof item !== "string") return { ok: false, code: "INVALID_DOMAIN" };
    const checked = validateSettingsHostname(item);
    if (!checked.ok) return checked;
    if (catalogHosts.includes(checked.value) || customHosts.includes(checked.value)) {
      return { ok: false, code: "DUPLICATE_HOST" };
    }
    customHosts.push(checked.value);
  }
  return {
    ok: true,
    value: { schemaVersion: 2, builtinSiteStates, customHosts },
    normalizedHosts: customHosts,
  };
}

export function classifySettingsRoute(input: Pick<SettingsRequestDTO, "method" | "path">): SettingsRouteDecision {
  const method = input.method.toUpperCase();
  const path = normalizeSettingsPath(input.path);
  if (path === null) return { kind: "business-request" };
  if (path === "/") return method === "GET" ? { kind: "settings-page" } : { kind: "settings-method-not-allowed" };
  if (path === "/api/settings") {
    if (method === "GET") return { kind: "settings-get" };
    if (method === "POST") return { kind: "settings-post" };
    return { kind: "settings-method-not-allowed" };
  }
  return { kind: "settings-not-found" };
}

export function isSettingsNamespaceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === GATEWAY_HOST && normalizeSettingsPath(parsed.pathname) !== null;
  } catch {
    return false;
  }
}

export function handleSettingsRequest(
  input: SettingsRequestDTO,
  dependencies: { kv: KeyValueStore; statusProvider: SessionStatusProvider; pageHtml: string },
): SettingsHttpResponse {
  const decision = classifySettingsRoute(input);
  if (decision.kind === "business-request") {
    return json(404, "INVALID_SETTINGS");
  }
  if (decision.kind === "settings-not-found") return json(404, "INVALID_SETTINGS");
  if (decision.kind === "settings-method-not-allowed") return json(405, "METHOD_NOT_ALLOWED");
  if (decision.kind === "settings-page") {
    clearNonce(dependencies.kv);
    return {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      body: dependencies.pageHtml,
    };
  }
  if (decision.kind === "settings-post" && bodyByteLength(input.body) > SETTINGS_BODY_MAX_BYTES) {
    return json(413, "BODY_TOO_LARGE");
  }
  const loaded = loadSettingsV2(dependencies.kv);
  if (decision.kind === "settings-get") return settingsGet(input, dependencies, loaded);
  return settingsPost(input, dependencies, loaded);
}

export function settingsErrorResponse(status: number, code: string): SettingsHttpResponse {
  return json(status, code);
}

function settingsGet(
  input: SettingsRequestDTO,
  dependencies: { kv: KeyValueStore; statusProvider: SessionStatusProvider },
  loaded: LoadedSettings,
): SettingsHttpResponse {
  if (!input.freshNonce || !NONCE_RE.test(input.freshNonce)) return json(503, "SETTINGS_UNAVAILABLE");
  if (!dependencies.kv.write(STORAGE_KEYS.settingsCsrf, JSON.stringify({ token: input.freshNonce, issuedAt: input.nowIso }))) {
    return json(500, "STORAGE_FAILED");
  }
  const settings = loaded.kind === "incompatible" ? defaultSettingsV2() : loaded.settings;
  const status = loaded.kind === "incompatible" ? "incompatible" : dependencies.statusProvider.getStatus();
  return {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify({ ok: true, data: pageFromSettings(settings, status), token: input.freshNonce }),
  };
}

function settingsPost(
  input: SettingsRequestDTO,
  dependencies: { kv: KeyValueStore },
  loaded: LoadedSettings,
): SettingsHttpResponse {
  const size = bodyByteLength(input.body);
  if (size > SETTINGS_BODY_MAX_BYTES) return json(413, "BODY_TOO_LARGE");
  if (!originAllowed(input.origin, input.referer)) return json(401, "UNAUTHORIZED");
  if (!jsonContentType(input.contentType)) return json(400, "INVALID_SETTINGS");
  if (!consumeNonce(dependencies.kv, input.token, input.nowIso)) return json(401, "UNAUTHORIZED");
  if (loaded.kind === "incompatible") return json(400, "INVALID_SETTINGS");
  const text = bodyText(input.body);
  if (text === null) return json(400, "INVALID_JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json(400, "INVALID_JSON");
  }
  const update = validateSettingsUpdate(parsed, BUILTIN_SITES.map((site) => site.host));
  if (!update.ok) return json(400, update.code);
  const current = loaded.settings;
  const next: SettingsV2 = {
    ...current,
    schemaVersion: 2,
    builtinSiteStates: update.value.builtinSiteStates,
    customHosts: update.value.customHosts,
    migrationWarnings: [],
  };
  if (!dependencies.kv.write(STORAGE_KEYS.settingsV2, JSON.stringify(next))) return json(500, "STORAGE_FAILED");
  return { status: 200, headers: jsonHeaders(), body: JSON.stringify({ ok: true }) };
}

function persistOrFailClosed(kv: KeyValueStore, settings: SettingsV2): LoadedSettings {
  if (!kv.write(STORAGE_KEYS.settingsV2, JSON.stringify(settings))) {
    return { kind: "fail-closed", settings: defaultSettingsV2() };
  }
  return { kind: "ready", settings };
}

function parseStoredV2(raw: string): SettingsV2 | "incompatible" | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.schemaVersion === "number" && record.schemaVersion > 2) return "incompatible";
  if (record.schemaVersion !== 2) return null;
  const base = defaultSettingsV2();
  if (typeof record.enabled !== "boolean" || typeof record.debug !== "boolean") return null;
  if (typeof record.gatewayBase !== "string") return null;
  try {
    gatewayHost(record.gatewayBase);
  } catch {
    return null;
  }
  if (!record.builtinSiteStates || typeof record.builtinSiteStates !== "object" || Array.isArray(record.builtinSiteStates)) return null;
  const states = record.builtinSiteStates as Record<string, unknown>;
  const builtinSiteStates: Record<string, boolean> = {};
  for (const site of BUILTIN_SITES) {
    if (typeof states[site.id] !== "boolean") return null;
    builtinSiteStates[site.id] = states[site.id] === true;
  }
  if (!Array.isArray(record.customHosts)) return null;
  const customHosts: string[] = [];
  for (const host of record.customHosts) {
    if (typeof host !== "string") return null;
    const checked = validateSettingsHostname(host);
    if (!checked.ok || customHosts.includes(checked.value) || BUILTIN_SITES.some((site) => site.host === checked.value)) return null;
    customHosts.push(checked.value);
  }
  const maxBytes = record.bodyRewriteMaxBytes;
  if (typeof maxBytes !== "number" || !Number.isFinite(maxBytes) || maxBytes <= 0) return null;
  const settings: SettingsV2 = {
    schemaVersion: 2,
    enabled: record.enabled,
    gatewayBase: record.gatewayBase,
    builtinSiteStates,
    customHosts,
    debug: record.debug === true,
    bodyRewriteMaxBytes: maxBytes,
    migrationWarnings: record.migrationWarnings === undefined ? [] : [],
  };
  if (Array.isArray(record.migrationWarnings) && record.migrationWarnings.includes(MIGRATION_WARNING)) {
    settings.migrationWarnings = [MIGRATION_WARNING];
  }
  const key = readOverride(record.wrdKeyOverride);
  const iv = readOverride(record.wrdIvOverride);
  if (key === "invalid" || iv === "invalid") return null;
  if (key) settings.wrdKeyOverride = key;
  if (iv) settings.wrdIvOverride = iv;
  if (settings.bodyRewriteMaxBytes <= 0) return base;
  return settings;
}

function readMigratableV1(raw: string): PluginSettingsV1 | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.schemaVersion !== 1) return null;
  const parsed = parseSettings(raw);
  const exactHosts = Array.isArray(record.exactHosts)
    ? record.exactHosts.filter((item): item is string => typeof item === "string")
    : parsed.exactHosts;
  return {
    ...parsed,
    exactHosts,
    includeSwufeWildcard: record.includeSwufeWildcard === true,
  };
}

function readOverride(value: unknown): string | null | "invalid" {
  if (value === undefined) return null;
  if (typeof value !== "string" || new TextEncoder().encode(value).length !== 16) return "invalid";
  return value;
}

function normalizeSettingsPath(path: string): string | null {
  if (!path.startsWith(SETTINGS_PREFIX)) return null;
  const rest = path.slice(SETTINGS_PREFIX.length) || "/";
  const cleaned = rest.split("?")[0]?.split("#")[0] ?? "/";
  if (cleaned === "" || cleaned === "/") return "/";
  return cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

function originAllowed(origin: string | undefined, referer: string | undefined): boolean {
  if (origin && origin !== SETTINGS_ORIGIN) return false;
  if (!referer) return true;
  try {
    return new URL(referer).origin === SETTINGS_ORIGIN;
  } catch {
    return false;
  }
}

function jsonContentType(value: string | undefined): boolean {
  if (!value) return false;
  return value.split(";")[0]?.trim().toLowerCase() === "application/json";
}

function consumeNonce(kv: KeyValueStore, token: string | undefined, nowIso: string): boolean {
  const raw = kv.read(STORAGE_KEYS.settingsCsrf);
  clearNonce(kv);
  if (!raw || !token || !NONCE_RE.test(token)) return false;
  try {
    const data = JSON.parse(raw) as { token?: unknown; issuedAt?: unknown };
    if (data.token !== token || typeof data.issuedAt !== "string") return false;
    const issued = Date.parse(data.issuedAt);
    const now = Date.parse(nowIso);
    return Number.isFinite(issued) && Number.isFinite(now) && now - issued >= 0 && now - issued <= SETTINGS_NONCE_TTL_MS;
  } catch {
    return false;
  }
}

function clearNonce(kv: KeyValueStore): void {
  kv.write(STORAGE_KEYS.settingsCsrf, null);
}

function bodyByteLength(body: string | Uint8Array | undefined): number {
  if (body === undefined) return 0;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  return body.byteLength;
}

function bodyText(body: string | Uint8Array | undefined): string | null {
  if (body === undefined) return "";
  if (typeof body === "string") return body;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

function json(status: number, code: string): SettingsHttpResponse {
  return { status, headers: jsonHeaders(), body: JSON.stringify({ ok: false, code }) };
}

function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
}
