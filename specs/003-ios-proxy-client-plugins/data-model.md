# 数据模型：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24

## 1. 原则

移动端插件没有数据库。持久状态只使用 Loon/Stash 提供的本地 persistent store，且保持最少。配置为低敏感；Session 高敏感；通知节流低敏感；错误状态只能保存脱敏信息；RewriteContext 默认只在运行时存在。

## 2. PluginSettingsV1

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "gatewayBase": "https://webvpn.swufe.edu.cn",
  "exactHosts": ["jwxt.swufe.edu.cn"],
  "includeSwufeWildcard": false,
  "debug": false,
  "bodyRewriteMaxBytes": 1048576
}
```

`1048576` 这里只是设计占位上限示例，最终默认值必须由宿主压测冻结，而不是直接照抄。

可选：`wrdKeyOverride`、`wrdIvOverride`。

约束：gateway 必须是 http(s) URL；exactHosts 只接受 hostname、自动小写去重；excluded host 不能被重新开启；body size 必须有上限。

## 3. SessionRecordV1

```json
{
  "schemaVersion": 1,
  "gatewayHost": "webvpn.swufe.edu.cn",
  "cookieHeader": "<sensitive>",
  "capturedAt": "2026-09-24T08:00:00.000Z",
  "lastConfirmedAt": null,
  "status": "captured"
}
```

规则：`cookieHeader` 只进入 gateway 请求注入代码；不能进入 console、通知、snapshot；测试只用虚构 Cookie；gateway 改变时旧 Session 自动失效。

### 为什么 V1 保存 gateway Cookie header 而不是固定 Cookie 名

当前 desktop 文档也把具体 Cookie 名视为需实机确认的外部事实。移动端不应一开始就猜单一 Cookie 名。第一阶段在严格 gateway scope 内保存请求发送的 Cookie 集合；真机确认最小必要集后再考虑结构化 V2。

## 4. SessionRecordV2 候选

只有在真机证据足够后才定义结构化 cookies（name/value/path）。V2 不是当前承诺。

## 5. NotificationThrottleV1

```json
{
  "schemaVersion": 1,
  "lastByEvent": {
    "login-required": 0,
    "session-expired": 0,
    "codec-failed": 0
  }
}
```

## 6. LastErrorV1

```json
{
  "schemaVersion": 1,
  "code": "CODEC_FAILED",
  "ts": "2026-09-24T08:00:00.000Z",
  "host": "jwxt.swufe.edu.cn",
  "detail": "encode-failed"
}
```

禁止保存 url/query/cookie/token/body/authorization/username。

## 7. RuntimeCompatibility

非持久模型：compatible、host、version/build、platform、missingCapabilities。

## 8. RewriteContext

```ts
interface RequestRewriteContext {
  originalUrl: string
  originalHost: string
  wrdUrl: string
  wrdPrefix: string
  gatewayOwned: boolean
}
```

`wrdUrl` 含可逆 token 与 path/query，默认仅内存使用。若宿主生命周期确实无法关联 request/response，才引入 TTL 很短的 `TransientRewriteRecord`，且不得保存 Cookie/body。

## 9. TileViewModel

非持久模型：state（setup-required/logged-out/ready/expired/error）、title、content、url。

## 10. 数据生命周期

| 数据 | 创建 | 更新 | 删除 |
| --- | --- | --- | --- |
| Settings | 安装/首次运行 | 用户参数变化 | 卸载或重置 |
| Session | 捕获 gateway Cookie | 新 Cookie / 有效确认 | 过期、登出、gateway 变化、手工清除 |
| Throttle | 首次通知 | 允许通知时 | 卸载/重置 |
| LastError | 错误 | 后续错误 | 成功恢复可清 |
| RewriteContext | 单次 request | 无 | response/超时 |

## 11. 版本与迁移

每个持久 JSON 必须有 `schemaVersion`：known → validate；older migratable → migrate；unknown future → `RUNTIME_INCOMPATIBLE`；corrupt → 安全清理/隔离并提示。

Session 若无法安全迁移，直接清除并要求重新登录，不猜测转换。

## 12. Storage Adapter

宿主 KV 只有 string 时，用 JSON serialize；所有 parse 都必须 try/catch + schema validate。

## 13. 隐私矩阵

| 数据 | 持久化 | 可日志 | 可通知 |
| --- | ---: | ---: | ---: |
| 学号/密码/MFA | 否 | 否 | 否 |
| CAS Cookie | 否 | 否 | 否 |
| WebVPN Cookie | 是 | 否 | 否 |
| WRD key/iv 默认常量 | 可配置 | 只记录默认/覆盖状态，不记录值 | 否 |
| Allowlist | 是 | 可 | 可摘要 |
| host | 可 | 可 | 必要时可 |
| path/query | 默认否 | 默认否 | 否 |
| response body | 否 | 否 | 否 |

## 14. 卸载与清除

第三方客户端“卸载插件”是否自动清 `$persistentStore` 不应被假设。若宿主允许，提供显式 reset：清 Session、LastError、Throttle，Settings 可恢复默认。不得尝试删除宿主 CA。
