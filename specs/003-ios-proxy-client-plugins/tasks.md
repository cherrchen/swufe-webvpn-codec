# Tasks: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: In Progress  
> Owner: cherrchen  
> Last Updated: 2026-09-25

## Phase P0 — Host Capability

- [x] T001 创建最小 Loon 插件，只包含 login `openUrl`/通知与 gateway request logger — 输入：官方 Script API — 输出：PoC — 依赖：无 — 验证：IOS-TC-G01/G06/G08 — 关联：IOS-REQ-002/003
- [x] T002 创建最小 Stash Override + Tile，加入 login URL 与 gateway request logger — 输出：PoC — 依赖：无 — 验证：IOS-TC-H01/H03/H05 — 关联：IOS-REQ-002/003
- [x] T003 真机执行 Loon CAS/MFA P0，不记录敏感值 — 依赖：T001 — 验证：IOS-TC-I01/I02
- [x] T004 真机执行 Stash CAS/MFA P0，不记录敏感值 — 依赖：T002 — 验证：IOS-TC-I03/I04
- [x] T005 冻结 P0 结论并更新 PRD/UI/架构 — 依赖：T003,T004 — 验证：Q-001/Q-002 Closed

## Phase M1 — Shared Core

- [x] T006 新建 `packages/webvpn-core-js` — 输出：package skeleton — 依赖：T005 — 验证：typecheck — 关联：IOS-NFR-004
- [x] T007 提取/生成 Python 权威 codec vectors — 输出：共享 vectors JSON — 依赖：无 — 验证：Python 现有实现读取并通过 — 关联：IOS-NFR-001
- [x] T008 实现 JS WRD codec — 依赖：T006,T007 — 验证：IOS-TC-A01..A09 — 关联：IOS-REQ-005
- [x] T009 实现 RoutingPolicy — 依赖：T006 — 验证：IOS-TC-B01..B09 — 关联：IOS-REQ-004
- [x] T010 实现 Session schema/store/capture pure logic — 依赖：T006 — 验证：IOS-TC-C01..C10 — 关联：IOS-REQ-003
- [x] T011 实现 request rewrite — 依赖：T008,T009,T010 — 验证：IOS-TC-D01..D09 — 关联：IOS-REQ-005/006
- [x] T012 实现 response header rewrite — 依赖：T008 — 验证：IOS-TC-E01..E04 — 关联：IOS-REQ-007
- [x] T013 实现 body rewrite + size guard — 依赖：T008 — 验证：IOS-TC-E05..E09 — 关联：IOS-REQ-007
- [x] T014 移植 gateway namespace/promotion 契约 — 依赖：T012,T013 — 验证：IOS-TC-E10/E11 — 关联：IOS-REQ-007
- [x] T015 实现 safe diagnostics/redaction — 依赖：T006 — 验证：IOS-TC-F01..F08 — 关联：IOS-REQ-009

## Phase M2 — Stash（首发宿主）

- 已完成基线：Stash Adapter、插件 bundles、Tile、Gateway Cookie capture/store、普通目标 WRD rewrite 时的 Gateway Session 注入、Settings V2/pseudo API 实现。
- 仍待 M2 收尾：Gateway direct request classifier/injection、Cookie precedence、login/logout 保护、Safe Auth Trace；wildcard/QUIC 与教务端到端真机验证。
- 退出条件：N02–N10 实现与验证；Settings E2E 通过；wildcard host/QUIC 能力实机通过，或采用静态 Interception 退化并更新验收；未选流量、authserver pass-through 与 Settings API security 有证据。

- [x] T022 实现 StashAdapter — 依赖：T011..T015 — 验证：Adapter unit — 关联：IOS-REQ-001/011
- [x] T023 生成 request/response/tile bundles — 依赖：T022 — 验证：bundle scan — 关联：IOS-REQ-011
- [x] T024 编写 Stash Override（GitHub 远程安装 URL） — 依赖：T023 — 输出：当前 M2 Override 制品 — 真机导入结果由 T027 记录 — 关联：IOS-REQ-001
- [x] T025 实现 Tile ViewModel — 依赖：T022 — 验证：IOS-TC-H02/H06/H12 — 关联：IOS-REQ-008
- [ ] T026 配置并验证目标域 HTTP/3 fallback — 依赖：T024 — 验证：IOS-TC-H09 — 关联：IOS-REQ-010
- [ ] T027 Stash 真机 E2E 教务 — 依赖：T024..T026 — 验证：IOS-TC-H03..H12 — 关联：AC-IOS-001/002

## Phase M3 — Loon

- [ ] T016 实现 LoonAdapter，覆盖首次 CAS 会话状态、原生 WebVPN 命名空间与 Header-only 响应 — 依赖：T011..T015 — 验证：Adapter unit、IOS-TC-G14..G17 — 关联：IOS-REQ-001/011
- [ ] T017 生成 request/response self-contained bundles — 依赖：T016 — 验证：bundle scan — 关联：IOS-REQ-011
- [ ] T018 编写 `.plugin` Argument/Script/MitM/Rule（GitHub 远程安装 URL），确认 HTTP/80 捕获与脚本日志/版本 — 依赖：T017 — 验证：IOS-TC-G01..G04/G13/G18 — 关联：IOS-REQ-001
- [ ] T019 实现 Session 缺失/过期通知节流 — 依赖：T016 — 验证：IOS-TC-G05 — 关联：IOS-REQ-008
- [ ] T020 验证 Loon QUIC/HTTP path — 依赖：T018 — 验证：IOS-TC-G12 — 关联：IOS-REQ-010
- [ ] T021 Loon 真机 E2E 教务 — 依赖：T018..T020 — 验证：IOS-TC-G07..G18 — 关联：AC-IOS-001/002

## Phase M4 — Hardening

- [ ] T028 压测 body size/timeout 并冻结默认值 — 依赖：T021,T027 — 验证：性能记录 — 关联：IOS-NFR-005
- [ ] T029 会话过期/重登验证 — 依赖：T021,T027 — 验证：过期流程 — 关联：AC-IOS-006
- [ ] T030 安全审计 storage/log/request scope — 依赖：T021,T027 — 验证：F 系列 — 关联：IOS-REQ-009
- [ ] T031 bundle dependency/license review — 依赖：T017,T023 — 验证：license manifest — 关联：IOS-REQ-011
- [ ] T032 desktop 全量回归 — 依赖：T030 — 验证：IOS-TC-J01 — 关联：IOS-NFR-009
- [ ] T033 更新长期 docs/ADR/README — 依赖：T032 — 验证：`pnpm run docs:check`
- [ ] T034 创建 GitHub Release / raw 安装链接、release artifact、rollback 验证 — 依赖：T033 — 验证：IOS-TC-J06/J07 — 关联：IOS-REQ-012
- [ ] T035 完成 verification 并推进 Spec 状态 — 依赖：T034 — 验证：映射表无 Must Pending

## Phase M2 Gateway Session Realm Follow-up

- [x] T050 实现 Gateway Request Kind classifier 的已知路径部分；Settings/WRD/root/login/精确 `/logout`/other 分类与未知路径默认不注入已有单测，callback 真实路径仍归 T052 真机确认 — 依赖：T011,T040 — 验证：本地 classifier matrix；N02/N04/N05/N06/N10 真机 Pending — 关联：IOS-REQ-016/017
- [x] T051 实现 direct Gateway Session injection：仅 webvpn.swufe.edu.cn、仅策略允许的 WRD 资源且 stored session ready 时使用 stored ticket，即使 request 自带不同 ticket；其它 Gateway 路径不覆盖请求 ticket；根页 200 才确认不同的新 ticket — 依赖：T010,T050 — 验证：本地 Core/Adapter；新策略 N02/N03–N04 真机 Pending — 关联：IOS-REQ-016
- [ ] T052 用户已确认正常 LOGOUT 为 `/logout`，本地已实现 request/response 双入口清理及不注入；仍需真机复核 Stash 脚本命中、LOGIN/AUTH_CALLBACK 路径、未知 pathname pass/no-injection — 依赖：T050,T051 — 验证：N04/N05/N10 — 关联：IOS-REQ-017
- [ ] T053 实现 Safe Auth Trace allowlist 与本地脱敏输出；支持 login-intent classification、raw authserver / WRD-wrapped authserver / redirect host / CAS service target hostname / tyxycg 阶段诊断 — 依赖：T015,T050,T051 — 验证：N07–N09；敏感字段负向审计 — 关联：IOS-REQ-018
- [ ] T054 Stash 真机验证 direct Gateway reuse、ticket precedence、过期、logout、login intent、Settings/authserver negative cases 与 tyxycg 诊断；记录宿主版本及脱敏证据 — 依赖：T051–T053,T058 — 验证：N02–N10 — 关联：AC-IOS-011..014

## Phase M2 — CAS Redirect Invalidation Boundary

- [ ] T058 调整/回归 Gateway Session 失效判定：CAS 页面或 redirect 本身不能清除 Gateway Session；仅核心 ticket 明确到期/清除或其它已真机确认的 Gateway 失效信号可清理；保留 tyxycg 自行要求 CAS 的 Session — 依赖：T010,T051 — 验证：G14/N04/N09 与 Gateway 失效信号矩阵 — 关联：IOS-REQ-016/018

## Phase M3 — Loon Gateway Session Parity additions

- [ ] T055 Loon Adapter 实现同一 Gateway Request Kind 与直接 Gateway Session 注入契约；不猜 endpoint，不将 CAS Cookie 纳入 store — 依赖：T016 — 验证：共享 Core contract + Adapter cases — 关联：IOS-REQ-016/017
- [ ] T056 Loon Adapter Safe Auth Trace allowlist/redaction 与 raw / WRD-wrapped authserver 区分 — 依赖：T055 — 验证：N07/N08 contract cases — 关联：IOS-REQ-018
- [ ] T057 Loon 真机验证 Safari capture 与跨 App/WKWebView direct Gateway reuse、ticket precedence、logout/login intent 与 tyxycg 分流 — 依赖：T055,T056,T021 — 验证：N01–N10 — 关联：AC-IOS-011..014

## 注意事项

- T026/T027 仍待 Stash 真机：HTTP/3 回落（H09）与教务 E2E；N02–N10 是新增 M2 follow-up。自动测试不能代替设备证据。
- P0 失败时先更新需求与架构，不用猜测继续实现；
- 真实 Cookie 不得写入 commit、Issue、PR、CI artifact；
- shared core 同一时段应有明确集成责任；
- 新增 AES 依赖必须做许可证、维护性与 bundle 审查，不能只因“能跑”就合入。

## Phase M2 Settings Feature Tasks

不得因已有 `RoutingPolicy.exactHosts` 就跳过宿主 Settings route。本地单测已覆盖的任务标为「本地完成」；真机取证仍未完成。

| Task | 状态 | 内容 / 输出 | 依赖 | 验收 / 证据 | AC |
| --- | --- | --- | --- | --- | --- |
| T036 | 本地完成 | Core hostname normalize/validate：hostname-only、SWUFE suffix、reserved host/IP/wildcard/URL 拒绝 | T006,T009 | L01–L03、K15–K17 | 004–006 |
| T037 | 本地完成 | 定义 SettingsV2 + defaults + builtin catalog（首期仅 jwxt）+ compile enabled sites → exact RoutingPolicy | T036 | B 系列 + M01–M04 | 003,008–010 |
| T038 | 本地完成 | 实现纯 V1→V2 migration 与 migration warnings；保持 session key 隔离 | T037 | L04–L08；检查 session key unchanged | 014–015 |
| T039 | 未完成 | 验证 Stash 安全 nonce 来源、Origin/Referer 可见性、request body 表示/上限；记录设备/版本 | 无 | K18–K20；得出可行/退化决定 | 前置条件 |
| T040 | 本地完成 | Stash Settings namespace route classifier + request entry 优先 short-circuit，API host adapter interface；namespace error catch 本地 synthetic 4xx/5xx | T039 | K10/K21/K22/M05；mock 证实业务 handler 未调用、异常不 fall through | 001,011 |
| T041 | 本地完成 | 构建 Settings HTML/CSS/JS 本地 bundle（无框架/CDN），实现 iOS/Dark Mode/safe-area UI | T040 | K01–K03；bundle 无远程 runtime UI | 001–002 |
| T042 | 本地完成 | 实现 GET synthetic HTML + GET settings + one-use local nonce 响应 | T040,T041 | K11–K12/K19；确认 no upstream | 001–002,011 |
| T043 | 本地完成 | 实现 POST parse/size/origin/token/schema/host validation + persistentStore write/errors | T036–T039,T042 | K13–K20；日志无 raw body | 005–007,011 |
| T044 | 本地完成 | Tile state/count/URL；动态 URL 若不稳定使用固定 Settings + 独立登录按钮 | T042 | K08–K09，记录 Stash version | 001 |
| T045 | 本地完成 | 每个业务请求将最新 V2 Settings 编译为精确 RoutingPolicy；未选项 PASS | T037,T043 | M01–M04 + cookie negative case | 008–010,017 |
| T046 | 未完成 | 复核 wildcard MitM、HTTP force-engine、request regex、SWUFE suffix QUIC Override | T039,T040 | M06–M07；导入及真机证据；无全局 UDP/443 | 016–017 |
| T047 | 本地完成 | Settings 安全回归：CSRF/origin/token/replay/size/reserved/upstream/cookie/log/migration/error fail-closed | T038,T043,T045,T046 | K14–K23、M05–M09、L08 | 005–017 |
| T048 | 未完成 | Stash Settings device E2E + update persistence；记录 App/iOS/Override/bundle 版本 | T041–T047 | K01–K09、M01–M09 | 001–017 |
| T049 | 未完成 | 同步 README、UI/security/update/rollback guide 与发布制品清单 | T048 | links/review；安全披露清楚 | 002,016–017 |
