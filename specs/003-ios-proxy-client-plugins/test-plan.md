# 测试计划：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-25

## 1. 目标

证明：JS Core 与 desktop Python 协议一致；Loon/Stash Adapter 正确映射宿主 API；Gateway Session Realm 可由代理层跨客户端安全复用；真实 iOS 的 Gateway 登录与业务访问流程可区分 CAS/SSO 跳转；安全边界成立。

## 2. 测试层级

### L0 Pure Unit

Node 环境执行：codec、allowlist、session parser、request decision、Gateway Request Kind classifier、stored-session readiness、Cookie merge precedence、response rewrite、schema validation、Safe Auth Trace redaction、CAS-only redirect 不清除 Gateway Session、explicit/unknown login intent 不注入。追加 Settings hostname normalize/validate、Builtin/custom compile、V1→V2 migration、Settings namespace route priority、pseudo response machine code 与 body size/token checks。覆盖 N02–N10 的纯逻辑部分，但单元测试不能替代对应真机用例。

### L1 Cross-language Contract

同一 `vectors.json` 同时由 Python `WrdCodec` 与 JS `WrdCodec` 运行。Python 是现有行为基线，向量文件成为跨语言共享事实。

### L2 Adapter Unit

mock Loon/Stash globals，测试 `$request/$response/$persistentStore/$notification/$done`、Tile output、version guard。

### L3 Bundle Smoke

release bundle：单文件可解析、无 Node built-in、无 unresolved imports、记录大小、许可清单、版本 banner、fixtures 不进 release。

### L4 Host Import Smoke

真机：Loon plugin / Stash override 可导入、enable/disable、script provider、MitM、debug log。

### L4 Stash 跨 App Gateway Session 复用（Pending）

1. Safari 打开 Tile，完成 WebVPN/CAS/MFA 登录；确认 Tile 已登录，Safe Trace 显示 `sessionAction=capture`，不得保存或展示 Cookie 值。
2. 在 Settings 将 `tyxycg.swufe.edu.cn` 加入 Routing Scope，并确认对应 Stash MitM/Script 实际命中；先确认 Safari 页面和 Tile 均显示已登录，再打开独立 App 的 WKWebView，触发该站点页面。记录脱敏链路：实际 host、route、gatewayKind、decodedOriginalHost、requestTicket、ticketRelation、storedSession、sessionAction、首次原生 WRD response 的 status/ticketSetCookie/locationGatewayKind、locationHost/locationAuth、serviceHost，以及 WebVPN 是否再次跳 `/login`。另从 Stash 上游请求视图只核对 Cookie header 是否存在，不记录值。
3. 分别复核解码目标已在 Routing Scope 的 `/http/<token>/...`、`/https/<token>/...` 和无 query 的 gateway 根路径 GET/HEAD；验证请求头注入后 URL 不变。解码失败或目标未入选的 WRD、Settings、raw authserver、`/login`、`/wengine-vpn/...`、未知路径与带 query 的根路径均不注入。对用户已确认的 gateway `/logout`，验证请求不注入、`swufe.session.v1` 清除，且响应不会重新保存 ticket。
4. 验证 ticket B 请求遇到 stored ticket A 时 B 优先且 store 更新；核对 Set-Cookie rotation、明确 ticket 删除、时钟过期、普通 jwxt 改写、响应反向改写和导航无重定向环。
5. 若注入后仍跳 gateway `/login`，检查网关所需 Cookie 集、path/domain、rotation 或其他绑定状态；若网关复用成功后 `tyxycg` 再跳 raw authserver，只记录为独立业务 CAS 流程，不在 M2 扩展 CAS Cookie 共享。

Stash Settings E2E 另验证 synthetic HTML、同源 API GET/POST、pseudo endpoint 未上游、Tile 动态/固定退化 URL、离线已缓存运行、Dark Mode/safe-area 与保存后路由即时变化。

### L5 P0 Login PoC

真实 iPhone/iPad：验证 openUrl/Tile URL 呈现位置、WebVPN → CAS → MFA → WebVPN、gateway request 是否进入 script、Cookie 能否捕获、页面关闭后 Session 是否保留。

### L6 End-to-end

校外网络：Safari 登录后确认 Gateway Session 写入 plugin store；再从没有自身 Gateway ticket 的独立 App/WKWebView 发起 direct Gateway request，验证分类允许且 login intent 确认为 none 时的代理层注入；覆盖显式/未知 login intent 不注入、新 ticket 优先、过期、logout、CAS-only redirect 不清 Session 和 Settings namespace；访问 tyxycg 时用 Safe Auth Trace 判别 Gateway 登录跳转与业务系统发起的 CAS。至少完成一项真实只读/低风险教务操作、redirect/Cookie/body rewrite、失效后重登、Wi-Fi/Cellular 冒烟。尚未在设备验证的场景在 verification 中保持 Pending。

Loon M3 执行时，按 [G13–G18](test-cases.md) 顺序记录：先确认 HTTP/80 命中与 `/http/` 上游，再覆盖首次 CAS 往返、原生 WebVPN bootstrap、Header-only 响应和更新后的日志可见性。对重定向记录脱敏的来源/目标主机与路径类别，并确认目标不是当前浏览器 URL；不得保存完整 WRD token。Stash M2 的对应修复只作为风险线索，Loon 的宿主行为须独立取证。

## 3. 测试环境

自动化使用仓库当前 Node/pnpm/Python 版本。真机至少 1 台 iPhone + 另一个 iOS/iPadOS 组合；最新受支持 Loon/Stash；测试者自有合法 SWUFE 账号；校外 Wi-Fi；蜂窝网络冒烟。

实际版本号在执行 verification 时记录，设计阶段不虚构。

## 4. 测试数据

可提交：虚构 hostname、deterministic codec vectors、虚构 Cookie、合成 HTML/JS/JSON、合成 Header。

禁止提交：真实 WebVPN Cookie、学号、密码、MFA、个人页面正文、含个人数据的 HAR。

## 5. Codec 向量

至少覆盖 jwxt、path/query、http、非默认端口、fragment、非法 host、malformed token、wrong key、IV/token 错误、roundtrip，并导入现有 Python 已验证向量。

## 6. 安全测试

- 非 allowlist 绝无 WebVPN Cookie；
- authserver 不保存认证 Cookie/body；
- raw authserver 必须 PASS，不注入 Gateway Session；WRD-wrapped authserver 只记录网关请求与解码 original host 的关系，不扩大普通 Routing Scope；
- Gateway ticket B 存在时 stored ticket A 不得覆盖 B；注入只对无客户端 ticket 且策略允许的 Gateway request kind 开放；
- logout 不注入旧 Session 并清本地 Gateway Session；CAS-only 页面/redirect 不清除 Gateway Session；explicit/unknown login intent 不注入；Settings Namespace 本地终结且不 capture、不注入、不 upstream；
- Safe Auth Trace 区分 raw authserver、WRD-wrapped authserver 和 tyxycg 业务跳转；只记录 service target hostname 与安全分类字段；
- log redact；
- notification 无 Session；
- corrupt storage 不 dump；
- remote URL 为 HTTPS；
- clear 后不再注入；
- Settings V2 没有 wildcard route 开关；默认 Routing Scope 由明确启用站点组成。
- Routing wildcard 不存在于 Settings V2；即使 Interception Scope wildcard enabled，未选中子域仍 PASS。
- Settings Namespace 不触发 Session capture/业务 rewrite，Settings API 绝不向 upstream。
- POST 的 Host/path/method/Origin/Referer/Content-Type/token/schema/body byte cap 均拒绝越界输入；token 过期/重放无写入。
- API、日志和错误中没有 Session/CAS Cookie、Authorization、MFA、WRD secret 或 POST 原文。
- V1→V2 migration 不改变 Session key；invalid hostname 不能扩大 Routing Scope。
- MitM interception wildcard 语义在用户说明中可见；证明只有选中项经 WebVPN。
- 新 Gateway Session Realm 用例见 [test-cases.md §N](test-cases.md)：除已经观察到的 Safari capture/persist 外，所有真实设备注入、logout、Settings/Authserver 与 tyxycg 诊断项必须单独取证。

## 7. P0 Login 记录模板

```text
Host app:
Version/build:
iOS/iPadOS:
Device:
Network:
Date:

1. Tap login URL
2. Record whether view stays in host app
3. Complete CAS
4. Complete MFA
5. Return to WebVPN
6. Inspect script log for session-captured event

Do NOT record password/MFA/cookie value.

Result:
- inAppWeb: yes/no
- redirectChainCompleted: yes/no
- requestScriptObservedGateway: yes/no
- sessionCaptured: yes/no
- notes:
```

## 8. 性能

首版不设无依据毫秒 SLA，但记录 request script elapsed、response header-only elapsed、body rewrite 100KB/500KB/1MB、bundle size、内存/termination。根据实测冻结 body max 与 timeout。

## 9. 回归

每次移动端改动都跑：existing pnpm tests、Python bridge tests、JS core tests、cross vectors、bundle smoke、docs check。不得破坏 desktop。

## 10. Entry Criteria

进入 Settings 真机 E2E 前：确认 Stash 安全 nonce 能力及 wildcard MitM/QUIC/force-http-engine 真正导入配置；否则采用并文档化静态 hostname 退化方案。Schema/API contract checks、bundle smoke、至少一个宿主配置导入完成。

## 11. Exit Criteria

- PRD Must 有证据；
- Loon/Stash 安装冒烟通过；
- 至少一个宿主完整 E2E；
- 另一宿主若无法 E2E，明确记录限制而不是标 Passed；
- P0 登录结论冻结；
- Settings API / synthetic route security cases pass；
- wildcard Interception Scope 与 exact Routing Scope 真机边界清楚，或采用静态 Interception 退化方案；
- 无 Session 泄露；
- 文档同步完成。
