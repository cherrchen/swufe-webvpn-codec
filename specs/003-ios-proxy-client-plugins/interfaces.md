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
  action: "pass" | "rewrite" | "session-captured" | "session-expired" | "body-skipped" | "error"
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

`.stoverride` 至少定义 `name/desc/openUrl/homepage`、`http.mitm`、`http.script`、`script-providers`、`tiles`。具体 YAML 必须由 Stash 真机导入验证。

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

## 16. 错误码

`MITM_NOT_READY` / `NOT_LOGGED_IN` / `SESSION_EXPIRED` / `CODEC_FAILED` / `INVALID_SETTINGS` / `RUNTIME_INCOMPATIBLE` / `BODY_TOO_LARGE` / `REWRITE_FAILED` / `STORAGE_FAILED`。

错误码用于机器判断；用户文案由 Adapter/ViewModel 映射。
