# 项目管理：iOS Proxy Client Plugins

> Status: Approved  
> Spec ID: 003  
> Owner: cherrchen  
> Last Reviewed: 2026-09-24

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

`.stoverride`、request/response、Tile、HTTP Engine/MitM、HTTP/3 处理、E2E jwxt；制品与脚本经本仓库 **GitHub**（Release 或 `raw.githubusercontent.com`）分发。退出：Stash 主路径通过或宿主限制明确记录。

## 5. M3 — Loon Adapter

`.plugin`、request/response bundle、persistent store、login-required notification、MitM/Rule、QUIC 路径、E2E jwxt；远程安装 URL 同样托管在 GitHub。退出：Loon 主路径、disable/update 冒烟通过。

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

## 10. 决策 Gate

### Gate A — P0 Login

若两个宿主都无法让登录后的 gateway request 被脚本观察，暂停产品化投入，评估外部 Safari 是否仍可观察、手工 Session 是否可接受、极小 Companion App 是否值得。不得偷偷把“手工复制 Cookie”当默认流程。

2026-09-24：两个宿主的 URL 都打开系统 Safari，但登录后的 gateway 请求仍被各自脚本看见。Gate A 通过，继续共享 Core。登录文案改为「打开网页登录」。

### Gate B — Core Parity

Python/JS vectors 未全绿，不进入真实账号 E2E。

### Gate C — Security

发现任意非 gateway 请求带 WebVPN Cookie，立即阻断发布。

## 11. Definition of Done

- [ ] PRD Must 实现或显式降级并接受
- [ ] Loon/Stash 制品可导入
- [ ] 至少一个宿主完整 E2E
- [ ] Python/JS parity
- [ ] Session security tests
- [ ] 过期/重登
- [ ] QUIC 路径验证
- [ ] desktop regression
- [ ] README 安装说明
- [ ] 长期 docs/ADR 同步
- [ ] release/rollback 验证

## 12. 文档同步计划

实现时检查 README、overview、goals/non-goals、functional/non-functional requirements、architecture overview/components/data-flow/interfaces/data-model、docs/api、security、roadmap、specs/README 及必要 ADR。长期 `docs/**` 按仓库规则中英双语同步；Feature Spec 可中文。

## 13. 不做的顺手优化

不重写 desktop Python、不重构 Electron UI、不建后端/账号系统、不支持更多代理 App、不做云同步、不做复杂 allowlist GUI、不自动化 CAS/MFA。
