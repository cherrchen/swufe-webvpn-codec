# 接口定义：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24

本文定义逻辑契约；实际 TypeScript 名称允许微调，但语义变更必须同步文档与契约测试。

## 1. Core URL Codec

```ts
export interface WrdCodecOptions {
  gatewayBase: string
  key: Uint8Array
  iv: Uint8Array
}

export interface WrdCodec {
  encryptHost(host: string): string
  decryptHost(token: string): string
  encodeUrl(ordinaryUrl: string): string
  decodeUrl(wrdUrl: string): string
}
```

错误码：`INVALID_KEY` / `INVALID_IV` / `INVALID_URL` / `UNSUPPORTED_SCHEME` / `INVALID_TOKEN` / `DECRYPT_FAILED`。不得把 key/cookie/token 全值拼进错误。

## 2. Routing

```ts
export interface RoutingPolicy {
  exactHosts: string[]
  includeSwufeWildcard: boolean
  excludedHosts: string[]
}

export type RouteDecision =
  | { kind: "gateway" }
  | { kind: "auth" }
  | { kind: "rewrite"; originalHost: string }
  | { kind: "pass" }
  | { kind: "invalid"; reason: string }
```

优先级：invalid → gateway → auth/excluded → exact → wildcard → pass。

Stash Settings V2 当前不启用 `includeSwufeWildcard`；仅 `compileEnabledSites(settings, builtinCatalog)` 产出的 exactHosts 进入 RoutingPolicy。Interception Scope 是宿主配置，不属于本 Core route decision。

## 3. Session Store

```ts
export interface SessionRecordV1 {
  schemaVersion: 1
  gatewayHost: string
  cookieHeader: string
  capturedAt: string
  lastConfirmedAt: string | null
  status: "captured" | "valid"
}

export interface SessionStore {
  load(): SessionRecordV1 | null
  save(session: SessionRecordV1): boolean
  clear(): boolean
}
```

`cookieHeader` 是敏感字段，任何 diagnostic serialization 必须省略。

## 4. Session Capture

```ts
export interface SessionCaptureInput {
  url: string
  headers: Record<string, string>
  nowIso: string
  gatewayHost: string
}

export type SessionCaptureResult =
  | { kind: "captured"; session: SessionRecordV1 }
  | { kind: "no_cookie" }
  | { kind: "not_gateway" }
  | { kind: "invalid" }
```

第一版不在接口层写死单一 Cookie name。

## 5. Request DTO / Decision

```ts
export interface RequestDTO {
  url: string
  method: string
  headers: Record<string, string>
  body?: string | Uint8Array
}

export interface RewriteSettings {
  gatewayBase: string
  wrdKey: string
  wrdIv: string
  routing: RoutingPolicy
  debug: boolean
}

export interface RequestRewriteContext {
  originalUrl: string
  originalHost: string
  wrdUrl: string
  wrdPrefix: string
  gatewayOwned: boolean
}

export type RequestDecision =
  | { kind: "pass" }
  | { kind: "capture_session"; session: SessionRecordV1; pass: true }
  | { kind: "login_required" }
  | { kind: "rewrite"; url: string; headers: Record<string,string>; context: RequestRewriteContext }
  | { kind: "error"; code: PluginErrorCode }
```

`rewriteRequest()` 不直接调用宿主 `$done()`。

## 6. Response DTO

```ts
export interface ResponseDTO {
  status: number
  headers: Record<string, string>
  body?: string | Uint8Array
}

export interface ResponseRewriteResult {
  response: ResponseDTO
  changed: boolean
  changes: Array<"location" | "set-cookie" | "body" | "promotion">
  sessionExpired: boolean
  warning?: "body-too-large" | "unsupported-body"
}
```

## 7. Body Rewrite

```ts
export interface BodyRewritePolicy {
  allowedContentTypes: string[]
  maxBytes: number
}
```

默认 content type 与 desktop 对齐：`text/html`、`application/javascript`、`text/javascript`、`application/json`。

## 8. Host Adapter Contract

```ts
export interface HostEnvironment {
  host: "loon" | "stash"
  version: string
  build?: number
  platform: "ios" | "ipados" | "macos" | "other"
}

export interface HostAdapter {
  env(): HostEnvironment
  read(key: string): string | null
  write(key: string, value: string | null): boolean
  notify(input: NotificationDTO): void
  debug(record: SafeDiagnosticRecord): void
  finishRequest(result: HostRequestResult): void
  finishResponse(result: HostResponseResult): void
}
```

## 9. Notification DTO

```ts
export interface NotificationDTO {
  event: "login-required" | "session-expired" | "codec-failed" | "runtime-incompatible"
  title: string
  body: string
  openUrl?: string
}
```

## 10. Safe Diagnostic

```ts
export interface SafeDiagnosticRecord {
  ts: string
  host: string | null
  direction: "request" | "response" | "system"
  action: "pass" | "rewrite" | "session-captured" | "session-expired" | "body-skipped" | "error" | "entered"
  code?: string
  detail?: string
}
```

禁止字段：cookie、authorization、password、body、WRD token、完整 URL query。

## 11. Storage Keys

```text
swufe.plugin.schema
swufe.settings.v1
swufe.session.v1
swufe.notification-throttle.v1
swufe.last-error.v1
```

## 12. Loon 制品接口

`swufe-webvpn.plugin` 至少包含 metadata、`[Argument]`、`[Rule]`、`[Script]`、`[Mitm]`。运行入口：`request.js → LoonAdapter → Core`；`response.js → LoonAdapter → Core`。

具体 Script 优先使用当前新版语法；若兼容旧版，必须在 release notes 声明。

## 13. Stash 制品接口

`.stoverride` 至少定义 `name/desc/openUrl/homepage`、`http.mitm`、`http.script`、`script-providers`、`tiles`。动态子域设计要求评估 wildcard MitM/HTTP engine 与 suffix QUIC reject。具体 YAML 必须由 Stash 真机导入验证；当前 Demo 尚未验证 wildcard 子域。

## 14. Tile 输出

```ts
export interface StashTileViewModel {
  title: "SWUFE WebVPN"
  content: string
  url: string
  icon?: string
}
```

## 15. 配置 Schema

```ts
export interface PluginSettingsV1 {
  schemaVersion: 1
  enabled: boolean
  gatewayBase: string
  exactHosts: string[]
  includeSwufeWildcard: boolean
  debug: boolean
  wrdKeyOverride?: string
  wrdIvOverride?: string
  bodyRewriteMaxBytes: number
}
```

key/iv override 若存在，UTF-8 byte length 必须为 16。

以上 `PluginSettingsV1` 是当前代码/既有存储格式，不是动态 Settings UI 最终存储 schema。V2 与迁移在本节追加定义；`swufe.session.v1` 保持独立。

## 16. Settings domain interfaces

```ts
export interface SiteDefinition {
  id: string;            // stable catalog id, e.g. "jwxt"
  name: string;          // display-only catalog label
  host: string;          // exact normalized hostname
  builtin: boolean;      // true: cannot delete; false: user custom
  enabled: boolean;
}

export interface SettingsV2 {
  schemaVersion: 2;
  enabled: boolean;
  gatewayBase: string;
  builtinSiteStates: Record<string, boolean>;
  customHosts: string[];
  hostSchemes: Record<string, "http" | "https">;
  debug: boolean;
  wrdKeyOverride?: string;
  wrdIvOverride?: string;
  bodyRewriteMaxBytes: number;
  migrationWarnings?: Array<"DROPPED_INVALID_OR_OUT_OF_SCOPE_HOST">;
}

export interface SettingsPublicDTO {
  schemaVersion: 2;
  builtinSiteStates: Record<string, boolean>;
  customHosts: string[];
  hostSchemes: Record<string, "http" | "https">;
}

export interface SettingsUpdateDTO extends SettingsPublicDTO {}

export interface SettingsPageDTO {
  settings: SettingsPublicDTO;
  status: "logged-in" | "logged-out" | "expired" | "incompatible";
  enabledSiteCount: number;
  migrationWarnings?: Array<"DROPPED_INVALID_OR_OUT_OF_SCOPE_HOST">;
}

export interface SettingsRepository {
  read(): string | null;
  write(serialized: string): boolean;
}

export interface SettingsNonceStore {
  read(): { token: string; issuedAt: string } | null;
  write(value: { token: string; issuedAt: string }): boolean;
  clear(): boolean;
}

export interface SessionStatusProvider {
  getStatus(): SettingsPageDTO["status"];
}

export type SettingsValidationResult<T> = {
  ok: true; value: T; normalizedHosts: string[];
} | {
  ok: false; code: "INVALID_JSON" | "INVALID_DOMAIN" | "RESERVED_HOST" |
    "DUPLICATE_HOST" | "BODY_TOO_LARGE" | "UNAUTHORIZED" | "INVALID_SETTINGS";
}

export interface SettingsService {
  getPage(statusProvider: SessionStatusProvider): SettingsPageDTO;
  save(input: unknown): SettingsValidationResult<SettingsPublicDTO>;
  compileRoutingPolicy(settings: SettingsV2): RoutingPolicy;
}

export interface SettingsRequestDTO {
  method: string;
  path: string;
  nowIso: string;
  origin?: string;
  referer?: string;
  contentType?: string;
  token?: string;
  freshNonce?: string; // generated by host adapter using a cryptographic RNG on GET
  body?: string | Uint8Array;
}

export interface SettingsHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface SettingsRouteHandler {
  classify(input: Pick<SettingsRequestDTO, "method" | "path">): SettingsRouteDecision;
  handle(input: SettingsRequestDTO, dependencies: {
    statusProvider: SessionStatusProvider;
    nonceStore: SettingsNonceStore;
  }): SettingsHttpResponse;
}

export interface SettingsApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  token?: string;
  code?: string;
}

export type SettingsRouteDecision =
  | { kind: "settings-page" }
  | { kind: "settings-get" }
  | { kind: "settings-post" }
  | { kind: "settings-not-found" }
  | { kind: "settings-method-not-allowed" }
  | { kind: "business-request" };
```

`SiteDefinition` is a view/catalog shape. Persisted `SettingsV2` stores stable builtin IDs and custom hostnames; it does not store builtin names or arbitrary `builtin` booleans that a client could forge. `SettingsPublicDTO` exposes only the site choices the simple UI manages. On save, service validates the update then merges it over stored V2, preserving non-UI fields such as plugin enabled state, gateway, debug, WRD overrides and body limit; API never returns secrets. Builtin catalog is compiled from plugin-owned source. Core contracts receive plain DTOs and have no Stash global dependency.

## 17. Domain normalization and validation

Settings input accepts hostname only, not URL. Algorithm:

1. Trim leading/trailing whitespace; reject empty input.
2. Lowercase ASCII; remove exactly one or more trailing dots.
3. Reject URL syntax (`://`), path, query, fragment, userinfo, port, wildcard, whitespace inside labels, IP literals/IPv4, and `localhost`.
4. Validate DNS hostname length (≤253; each label 1–63) and label syntax `[a-z0-9]([a-z0-9-]*[a-z0-9])?`.
5. Require suffix `.swufe.edu.cn` and at least one non-empty label before it; apex `swufe.edu.cn` is rejected for custom hosts.
6. Reject exact gateway/authserver hosts, including case/trailing-dot aliases after normalization.
7. Normalize duplicates across enabled builtins/custom hosts; POST rejects duplicate custom hosts with `DUPLICATE_HOST` (UI may focus the existing item); never silently broaden to wildcard.

Examples: ` JWXT.SWUFE.EDU.CN. ` → `jwxt.swufe.edu.cn`; `https://jwxt.swufe.edu.cn/foo?a=1`, `*.swufe.edu.cn`, `localhost`, `127.0.0.1`, `foo/bar`, `foo@bar.com`, `foo.com`, gateway and authserver are rejected.

## 18. Settings pseudo API (Stash Adapter contract)

Base URL: `https://webvpn.swufe.edu.cn/__swufe_bridge__/`. All matching routes short-circuit before the regular request pipeline. Unknown paths return synthetic 404; wrong methods return synthetic 405. No response may fall through to actual WebVPN upstream.

Settings request DTO passes only method/path, Origin, Referer, Content-Type, Settings token, and bounded body. The Adapter must not pass Cookie/Authorization or log all headers. `SettingsHttpResponse` is a logical response; the Stash Adapter maps it to the host's documented request-script synthetic response shape, without leaking Stash globals into Core.

| Request | Contract |
| --- | --- |
| `GET /` | `200 text/html; charset=utf-8`, locally bundled HTML, `Cache-Control: no-store` |
| `GET /api/settings` | `200 application/json`, `{ok:true,data:<SettingsPageDTO>,token:<one-use nonce>}`; only site choices, non-sensitive migration warning and login-state enum; omit key/iv overrides and all cookies |
| `POST /api/settings` | UTF-8 body ≤ 16 KiB, `Content-Type: application/json`, `X-SWUFE-Settings-Token`, same-origin metadata when available; validated V2 update DTO only |

Success: `200 {"ok":true}`. Failure uses non-sensitive machine code: `400 INVALID_JSON|INVALID_DOMAIN|RESERVED_HOST|DUPLICATE_HOST|INVALID_SETTINGS`, `401 UNAUTHORIZED`, `413 BODY_TOO_LARGE`, `405 METHOD_NOT_ALLOWED`, `500 STORAGE_FAILED`, or `503 SETTINGS_UNAVAILABLE` when secure nonce generation fails. Error output never echoes submitted host/body or stored secrets. Any error after the host+namespace has matched returns a synthetic error response; it must never use the generic business pass-through fallback.

The token is a single-use 128-bit-or-stronger nonce with a two-minute TTL, tied to the latest Settings page GET and stored locally as `swufe.settings.csrf.v1`; a newer page GET may invalidate an older tab's token. It must be generated from a cryptographically secure source available in the Stash script runtime; capability is open until verified. If unavailable, POST is disabled/fail-closed. No fixed script token, `Math.random()` token, server-side session, credential, or API for Session is allowed. POST body limit is 16 KiB UTF-8 bytes. Implementation must verify that oversize Settings POST requests are terminated locally with `413` and cannot bypass the handler to reach gateway upstream; Stash's documented `max-size` option says oversized requests do not trigger a script, so it must not be used unless a separate fail-closed guard is proven. Runtime body-buffering cost also requires device validation.

Security checks: exact gateway Host + reserved path + method; Origin must equal Settings origin when present; Referer must have same origin when present; reject cross-origin indications; require JSON content type and one-use token; parse only bounded body; validate whole schema and every host before write. If Stash omits Origin/Referer from `$request.headers`, the token remains mandatory and this limitation must be threat-modeled before release. CORS headers are not emitted. Handler must not inspect or log inbound Cookie/Authorization headers, must not forward any Settings request, and must not set cookies. Settings GET does not set/open CAS or gateway session state.

## 19. Settings persistence keys

```text
swufe.settings.v2
swufe.settings.csrf.v1       # one-use token + issuedAt; two-minute TTL
swufe.session.v1              # unchanged, isolated Session data
swufe.notification-throttle.v1
swufe.last-error.v1
```

`swufe.settings.v1` is read only for migration. Settings API writes only `swufe.settings.v2`; it never clears/replaces the session key.

## 20. 错误码

`MITM_NOT_READY` / `NOT_LOGGED_IN` / `SESSION_EXPIRED` / `CODEC_FAILED` / `INVALID_SETTINGS` / `RUNTIME_INCOMPATIBLE` / `BODY_TOO_LARGE` / `REWRITE_FAILED` / `STORAGE_FAILED`。

错误码用于机器判断；用户文案由 Adapter/ViewModel 映射。
