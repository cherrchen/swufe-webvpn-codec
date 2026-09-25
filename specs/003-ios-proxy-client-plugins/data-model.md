# 数据模型：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-25

## 1. 原则

移动端插件没有数据库。持久状态只使用 Loon/Stash 提供的本地 persistent store，且保持最少。配置为低敏感；Session 高敏感；通知节流低敏感；错误状态只能保存脱敏信息；RewriteContext 默认只在运行时存在。

## 2. PluginSettingsV1 (legacy)

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
  "expiresAt": null,
  "status": "captured"
}
```

规则：`cookieHeader` 只属于 `webvpn-gateway` Realm，只能进入目标为 `webvpn.swufe.edu.cn` 的合规 gateway 请求注入代码；不能进入普通源站、authserver、console、通知、snapshot 或 Trace。测试只用虚构 Cookie；gateway 改变时旧 Session 自动失效。核心票据名已确认是 `wengine_vpn_ticketwebvpn_swufe_edu_cn`；`expiresAt` 只来自该票据的 `Max-Age` 或 `Expires`。旧记录缺该字段时按 `null`（时效未知）读取，不因此清会话。本地时钟到点后不再注入。没有过期属性时不编造时长。服务端提前作废的真实信号与辅助 Cookie 最小集合仍待真机确认；再次出现 CAS 本身不能单独判定 Gateway Session 已失效。Q-001 保留为最小 Cookie 集与失效信号问题。

Gateway Session 可通过代理层在不同 App、WKWebView 与 Safari 请求间复用；它不依赖客户端 Cookie Jar。`Browser Cookie Jar != Plugin Gateway Session Store`。注入时保留请求已有 Cookie 值；若请求已带核心 Gateway ticket，则不注入旧记录，并 capture/refresh 当前请求的 ticket。

### 为什么 V1 保存 gateway Cookie header

核心票据名已确认，但最小可用辅助 Cookie 集仍需真机收敛。因此 V1 仍保存 Gateway host 请求携带的 Cookie header，且 Realm 隐含为 `webvpn-gateway`；不为本次设计引入 schema 迁移。Gateway host 限定和 ticket 存在性校验是硬约束。真机确认最小必要集合后，再评估结构化 V2。

## 4. SessionRecordV2 候选

只有在真机证据足够后才定义结构化 cookies（name/value/path）。V2 不是当前承诺。

## 4.1 Session Realm

领域类型：

```ts
type SessionRealm = "webvpn-gateway" | "cas-sso"
```

当前 M2 只实现 `webvpn-gateway`。现有 `SessionRecordV1` 与 `swufe.session.v1` 保持不变并隐含该 Realm；本轮不强制新增 `realm` 字段。

未来 `cas-sso` 只能作为单独评审的可选高风险能力：默认关闭、独立威胁建模、独立存储 key、独立生命周期，只能发送给 `authserver.swufe.edu.cn`。它不得与 Gateway Cookie 拼接、复用或迁移进 `swufe.session.v1`，也不是 M2 的隐含任务。

## 4.2 Gateway Session readiness 与 trace

可注入的 Gateway Session 至少满足：记录可解析且 schema 可识别、`gatewayHost` 精确为 `webvpn.swufe.edu.cn`、`cookieHeader` 含核心 ticket、`expiresAt` 未到期。`captured` 表示已捕获且可用于 Gateway 请求，不等同于业务站点登录已端到端验证；`valid` 表示后续成功响应已确认。时钟到期、显式 `/logout` 或可归属于当前 stored ticket 的服务端删除信号才使这份共享 Session 失效；其它 App 的无 ticket/不同 ticket 请求收到删除信号，不证明 stored ticket 失效。已有 stored ticket 时，Gateway 响应下发的新 ticket 也必须与请求所用 stored ticket 关联，才能更新这份共享记录；无 ticket/不同 ticket 请求下发的新 ticket 不替换它。

Safe Auth Trace 为仅内存、短时的运行态诊断结构，不进入本数据模型的持久化对象。具体字段 allowlist 与禁止字段见 [interfaces.md §10](interfaces.md)。CAS `service` 参数只可抽取 target hostname；完整 service URL、Cookie value、CAS ticket、`execution`、完整 query、WRD token 与请求/响应正文均禁止记录。

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
| CAS Cookie / CAS ticket | 否 | 否 | 否 |
| Gateway Session Cookie（含核心 ticket） | 是，仅 `webvpn.swufe.edu.cn` Realm | 否 | 否 |
| WRD key/iv 默认常量 | 可配置 | 只记录默认/覆盖状态，不记录值 | 否 |
| Allowlist | 是 | 可 | 可摘要 |
| host | 可 | 可 | 必要时可 |
| path/query | 默认否 | 仅 pathname 分类，不留原始路径或 query | 否 |
| Safe Auth Trace | 否，仅内存短时 | 仅 allowlist 字段 | 否 |
| response body | 否 | 否 | 否 |

## 14. 卸载与清除

第三方客户端“卸载插件”是否自动清 `$persistentStore` 不应被假设。若宿主允许，提供显式 reset：清 Session、LastError、Throttle，Settings 可恢复默认。不得尝试删除宿主 CA。

## 15. PluginSettingsV2（动态站点设置）

持久化 key：`swufe.settings.v2`。站点目录（显示名、builtin 标志、域名）由插件版本内置，用户配置只存稳定 builtin id 的开关状态和 custom hostname，避免客户端篡改 `builtin` 属性或存储重复展示文案。

```json
{
  "schemaVersion": 2,
  "enabled": true,
  "gatewayBase": "https://webvpn.swufe.edu.cn",
  "builtinSiteStates": { "jwxt": true },
  "customHosts": [],
  "hostSchemes": {},
  "debug": false,
  "bodyRewriteMaxBytes": 1048576,
  "migrationWarnings": []
}
```

`bodyRewriteMaxBytes` 的数值仍是 schema 示例/沿用字段，最终默认必须依据宿主压测冻结。V2 去除 `exactHosts` 与 `includeSwufeWildcard` 两个 V1 Routing 层字段。唯一 builtin 是有可靠事实支持的 `jwxt.swufe.edu.cn`，id 为 `jwxt`；未来加入 builtin 需确认官方 hostname 并稳定 id。

`SiteDefinition` 是 UI view model：`{ id, name, host, enabled, builtin }`。Core Settings 持久格式不保存任意 SiteDefinition 数组，避免 UI concern 渗入 routing Core；SettingsService 从 source catalog + V2 状态合成列表，再归一化为 exact RoutingPolicy。自定义项显示名可由 hostname 生成，不存独立任意标签。

方案比较：直接持久化 `SiteDefinition[]` 对 UI 直观，但会把显示名、builtin 可删除性与 Core storage schema 绑定，也允许客户端伪造 builtin 标志；本 Spec 选择 `builtinSiteStates + customHosts`，migration 可按 stable builtin id 映射，Core 只需处理 DTO/host，不依赖 UI 文案。

## 16. V1 → V2 migration

读取顺序：先读 `swufe.settings.v2`；若不存在，再读 `swufe.settings.v1` 并纯函数迁移；若两者都不存在，使用 V2 defaults。只有 schema 校验成功后才写入 v2。未知 future schema 不覆盖原值，返回 `RUNTIME_INCOMPATIBLE`。

迁移规则：

1. 保留合法的 `enabled`、`gatewayBase`、`debug`、key/iv overrides、`bodyRewriteMaxBytes`。
2. 规范化 V1 `exactHosts`；与 `webvpn.swufe.edu.cn`、`authserver.swufe.edu.cn` 相同的项丢弃。
3. `jwxt.swufe.edu.cn` 映射到 `{builtinSiteStates: {jwxt: true}}`。
4. 其他合法精确 host 仅在严格满足 `.swufe.edu.cn` 子域规则时放入 `customHosts`；非法、外部域、IP、apex 和 wildcard 项丢弃，并设置不含原始值的 `migrationWarnings: [DROPPED_INVALID_OR_OUT_OF_SCOPE_HOST]` 供 UI 摘要提示。成功保存新 Settings 后清空该 warning。
5. 一律把旧 `includeSwufeWildcard` 设为不迁移/关闭。用户必须明确逐项选择目标，不能由通配符隐式扩大 Routing Scope。
6. 将 normalized V2 写到 `swufe.settings.v2`。迁移不调用 SessionStore，不读写、不清除 `swufe.session.v1`；Settings 保存也不得改变 Session。

迁移过程中若 v2 写入失败，保留 v1 原值、当前页面显示错误并 fail closed 使用默认路由；不得因迁移失败回退为 wildcard routing。迁移结果的 warnings 不包含被丢弃 hostname 明文。

## 17. 默认与敏感性

默认 `builtinSiteStates.jwxt = true`，`customHosts = []`，`hostSchemes = {}`，无 wildcard routing。`hostSchemes` 只保存显式选择的 `https`；缺省项在改写时使用 HTTP，因此新增域名不必逐个填写协议。Settings API 返回 public Settings DTO 时不包含 WRD key/iv overrides。敏感性：站点选择为低敏感；CSRF nonce 为短期本机秘密；WebVPN Cookie 仍是独立高敏感 `swufe.session.v1`。
