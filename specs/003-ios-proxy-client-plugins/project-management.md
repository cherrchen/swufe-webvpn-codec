# 项目管理：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-25

## 1. 交付策略

先验证最不确定、最影响产品形态的“宿主内网页登录与 Session Capture”，再扩展协议和双客户端支持。不要先投入大量 UI/重写代码，最后才发现登录流量不经过插件。

```text
P0 Host capability PoC → M1 Shared Core → M2 Stash → M3 Loon → M4 E2E/Security/Release
```

## 2. Phase P0 — 宿主能力验证

目标：明确 URL 呈现方式、网页流量是否经过同一 Script、CAS/MFA 跨域链路、gateway Cookie 是否可观察。

退出：OQ-001/OQ-002 两宿主均有实机结论；至少一个宿主能 Session Capture，或项目明确改路线。2026-09-24 已满足：Safari 呈现，脚本可观察 gateway。

## 3. M1 — Shared Core

新建 `packages/webvpn-core-js`；codec/routing/session/rewrite；Python/JS vectors；safe diagnostics。退出：L0/L1 全绿、无 Host API 泄漏、无真实敏感测试数据。

## 4. M2 — Stash Adapter（首发宿主）

已交付基线包括 Stash Adapter、Override、request/response/Tile bundles、Gateway Cookie capture/store、普通目标 WRD request 的 Gateway Session 注入、Settings UI/pseudo API、Settings V2 与 migration。新增 M2 follow-up 包含 direct Gateway classification/injection、ticket precedence、logout/login-intent 安全、CAS-only redirect 不清 Session 与 Safe Auth Trace；实现前须遵循本轮分类策略，不猜真实 pathname。设备验证仍有 wildcard/QUIC、Settings E2E、direct Gateway reuse 与教务 E2E。退出条件为 N02–N10 取证、Gateway/CAS 边界与 Settings 安全验证；动态 interception 不成立时需写明静态 fallback。制品与脚本经本仓库 GitHub 分发。

## 5. M3 — Loon Adapter

.plugin、request/response bundle、persistent store、login-required notification、MitM/Rule、QUIC 路径、Gateway Request Kind 与 direct Gateway Session reuse、Safe Auth Trace、E2E jwxt；远程安装 URL 同样托管在 GitHub。退出：Loon 主路径、跨 App Gateway Session、ticket precedence、CAS boundary、disable/update 冒烟通过。

## 6. M4 — Hardening & Release

body 压测、Session 过期、安全审计、文档、安装链接、rollback、desktop regression。退出：verification 无 Must Pending，安全红线 Passed。

## 7. 工作流

建议分支：`feat/ios-proxy-client-plugins`、`feat/ios-plugin-core`、`feat/ios-plugin-stash`、`feat/ios-plugin-loon`（实现顺序与 M2/M3 一致）。Core API 变更必须更新两 Adapter contract；协议语义变更必须有 Python parity；Session 逻辑变更必须跑 security tests。

## 8. CI

新增 `plugin-core`（typecheck/lint/unit/cross-vector）、`plugin-bundle`（build/scan/size/license），并保留 Python tests、desktop tests、docs check。真机结果记录在 verification，不伪造 CI 证据。

## 9. 风险登记

| ID | 风险 | 概率 | 影响 | 缓解 |
| --- | --- | --- | --- | --- |
| R-IOS-001 | openUrl 非 App 内网页 | 中 | 中 | Safari fallback + 文案更新 |
| R-IOS-002 | App 内网页不进 Script | 中 | 高 | P0 前置；必要时重评 Companion App |
| R-IOS-003 | Cookie jar/代理观察不一致 | 中 | 高 | 真机验证 |
| R-IOS-004 | HTTP/3 绕过 Stash Engine | 高 | 高 | 目标域回落 TCP |
| R-IOS-005 | Loon QUIC 控制过于全局 | 中 | 中 | 优先局部规则，不默认全局禁 UDP/443 |
| R-IOS-006 | 大 body 超时/内存高 | 中 | 中 | maxBytes guard |
| R-IOS-007 | WebVPN key/iv/Cookie 改变 | 中 | 高 | 配置覆盖、Session 不硬编码单 Cookie |
| R-IOS-008 | AES dependency 停更 | 中 | 中 | pin + review + vectors + 可替换 backend |
| R-IOS-009 | 宿主 API 变化 | 中 | 中 | version guard + Adapter isolation |
| R-IOS-010 | 用户其它 Rewrite 冲突 | 中 | 中 | 排障指引，不改他人配置 |
| R-IOS-011 | Session 泄露日志 | 低 | 极高 | structured safe log + negative tests |
| R-IOS-012 | Wildcard MitM 扩大本机可解密 SWUFE 子域 | 中 | 高 | Settings 安装说明明示范围；Routing exact allowlist；未选流量 PASS 与 Cookie negative tests；无法可靠支持则退回静态域声明 |
| R-IOS-013 | Settings pseudo endpoint 被其他网页滥用写配置 | 中 | 高 | secure one-use nonce、Origin/Referer、JSON-only、schema、body limit；安全随机能力为实现前 Gate |
| R-IOS-014 | Stash 不支持任意子域 force-http-engine/脚本命中或 QUIC suffix rule | 中 | 高 | 用当前官方语法导入真机验证；只拒绝 SWUFE suffix QUIC；必要时采用静态范围并要求更新 Override |
| R-IOS-015 | Settings 路由错误 fall through 到真实 gateway | 低 | 高 | 保留命名空间全路径 short-circuit；未知路径合成本地 404/405；upstream capture 用例 |
| R-IOS-016 | oversized POST 因宿主 `max-size` 行为绕过脚本而到达真实 gateway | 中 | 极高 | 禁用未经验证的 `max-size` shortcut；证明超限请求本地 413 且不上游，否则 POST API 不可发布 |
| R-IOS-017 | direct Gateway request 无客户端 Cookie 时未注入 stored Gateway Session，App 重入登录流 | 高 | 高 | 只对经 classifier 明确许可、无请求 ticket 且 Session 可用的 Gateway request 注入；N02 设备验证通过后才能验收 |
| R-IOS-018 | stored ticket 覆盖了 App 自带的新 ticket，导致登录/轮换流异常 | 中 | 高 | request Cookie 优先；请求带 ticket 时先 capture/refresh 并原样 PASS；覆盖测试 N03 |
| R-IOS-019 | Safe Auth Trace 输出 Cookie、CAS ticket、execution、query 或 WRD token | 中 | 极高 | 字段 allowlist、只记录 pathname class/service hostname、敏感字段负向验证；N08/N09 |
| R-IOS-020 | 业务系统自身要求 CAS 被误诊为 Gateway Session 复用失败 | 中 | 中 | raw 与 WRD wrapped authserver 区分；Trace 同时记录 request host、decoded original host、Gateway Session 注入状态与 redirect host；真机 tyxycg 场景验证 |

## 10. 决策 Gate

### Gate A — P0 Login

若两个宿主都无法让登录后的 gateway request 被脚本观察，暂停产品化投入，评估外部 Safari 是否仍可观察、手工 Session 是否可接受、极小 Companion App 是否值得。不得偷偷把“手工复制 Cookie”当默认流程。

2026-09-24：两个宿主的 URL 都打开系统 Safari，但登录后的 gateway 请求仍被各自脚本看见。Gate A 通过，继续共享 Core。登录文案改为「打开网页登录」。

### Gate B — Core Parity

Python/JS vectors 未全绿，不进入真实账号 E2E。

### Gate C — Security

发现任意非 gateway 请求带 WebVPN Cookie，立即阻断发布。

### Gate E — Gateway Session Realm / Direct Reuse

M2 direct Gateway injection may be enabled only after Settings short-circuit, authserver pass-through, request Cookie precedence, session readiness and Gateway Request Kind classification are implemented. Login and logout must not be overridden by stored state; explicit or unknown login intent never receives stored injection; logout endpoint is unknown until captured on device and remains no-injection until then. A CAS page/redirect alone never clears the Gateway Session. The existing SessionRecordV1 remains Gateway-only. CAS Session Bridge is outside this gate and cannot be inferred from a repeated CAS page. N02–N10 device evidence is required; unit tests alone cannot close the gate.

### Gate D — Dynamic Scope / Settings Host Capabilities

在编码 Settings POST 前确认 Stash runtime 可用的安全随机 token source、请求 Origin/Referer 透传字段、body 字节长度/大小上限、合成 response 语法；确认 wildcard MitM + HTTP script regex + suffix QUIC 规则在目标 Stash 版本可导入并命中。任一核心能力不成立时，先收敛为预声明静态 host 设置，不伪称动态拦截成立。

## 11. Definition of Done

- [ ] PRD Must 实现或显式降级并接受
- [ ] Loon/Stash 制品可导入
- [ ] 至少一个宿主完整 E2E
- [ ] Python/JS parity
- [ ] Session Realm isolation, direct Gateway injection, client ticket precedence and logout tests
- [ ] Safe Auth Trace allowlist/redaction and tyxycg device diagnosis
- [ ] 过期/重登
- [ ] QUIC 路径验证
- [ ] Settings pseudo UI/API、自包含与 V1→V2 migration
- [ ] Settings CSRF/schema/body-size/upstream/cookie security checks
- [ ] Interception Scope 与 Routing Scope 分开验证并对用户披露
- [ ] desktop regression
- [ ] README 安装说明
- [ ] 长期 docs/ADR 同步
- [ ] release/rollback 验证

## 12. 文档同步计划

实现时检查 README、overview、goals/non-goals、functional/non-functional requirements、architecture overview/components/data-flow/interfaces/data-model、docs/api、security、roadmap、specs/README 及必要 ADR。长期 `docs/**` 按仓库规则中英双语同步；Feature Spec 可中文。

## 13. 不做的顺手优化

不重写 desktop Python、不重构 Electron UI、不建后端/账号系统、不支持更多代理 App、不做云同步、不做复杂管理后台、不自动化 CAS/MFA。轻量 Stash Settings 网站列表管理属于本 Feature scope。
