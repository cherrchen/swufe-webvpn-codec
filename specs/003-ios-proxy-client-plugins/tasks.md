# Tasks: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: Draft  
> Owner: cherrchen  
> Last Updated: 2026-09-24

## Phase P0 — Host Capability

- [ ] T001 创建最小 Loon 插件，只包含 login `openUrl`/通知与 gateway request logger — 输入：官方 Script API — 输出：PoC — 依赖：无 — 验证：IOS-TC-G01/G06/G08 — 关联：IOS-REQ-002/003
- [ ] T002 创建最小 Stash Override + Tile，加入 login URL 与 gateway request logger — 输出：PoC — 依赖：无 — 验证：IOS-TC-H01/H03/H05 — 关联：IOS-REQ-002/003
- [ ] T003 真机执行 Loon CAS/MFA P0，不记录敏感值 — 依赖：T001 — 验证：IOS-TC-I01/I02
- [ ] T004 真机执行 Stash CAS/MFA P0，不记录敏感值 — 依赖：T002 — 验证：IOS-TC-I03/I04
- [ ] T005 冻结 P0 结论并更新 PRD/UI/架构 — 依赖：T003,T004 — 验证：Q-001/Q-002 Closed

## Phase M1 — Shared Core

- [ ] T006 新建 `packages/webvpn-core-js` — 输出：package skeleton — 依赖：T005 — 验证：typecheck — 关联：IOS-NFR-004
- [ ] T007 提取/生成 Python 权威 codec vectors — 输出：共享 vectors JSON — 依赖：无 — 验证：Python 现有实现读取并通过 — 关联：IOS-NFR-001
- [ ] T008 实现 JS WRD codec — 依赖：T006,T007 — 验证：IOS-TC-A01..A09 — 关联：IOS-REQ-005
- [ ] T009 实现 RoutingPolicy — 依赖：T006 — 验证：IOS-TC-B01..B09 — 关联：IOS-REQ-004
- [ ] T010 实现 Session schema/store/capture pure logic — 依赖：T006 — 验证：IOS-TC-C01..C10 — 关联：IOS-REQ-003
- [ ] T011 实现 request rewrite — 依赖：T008,T009,T010 — 验证：IOS-TC-D01..D09 — 关联：IOS-REQ-005/006
- [ ] T012 实现 response header rewrite — 依赖：T008 — 验证：IOS-TC-E01..E04 — 关联：IOS-REQ-007
- [ ] T013 实现 body rewrite + size guard — 依赖：T008 — 验证：IOS-TC-E05..E09 — 关联：IOS-REQ-007
- [ ] T014 移植 gateway namespace/promotion 契约 — 依赖：T012,T013 — 验证：IOS-TC-E10/E11 — 关联：IOS-REQ-007
- [ ] T015 实现 safe diagnostics/redaction — 依赖：T006 — 验证：IOS-TC-F01..F08 — 关联：IOS-REQ-009

## Phase M2 — Loon

- [ ] T016 实现 LoonAdapter — 依赖：T011..T015 — 验证：Adapter unit — 关联：IOS-REQ-001/011
- [ ] T017 生成 request/response self-contained bundles — 依赖：T016 — 验证：bundle scan — 关联：IOS-REQ-011
- [ ] T018 编写 `.plugin` Argument/Script/MitM/Rule — 依赖：T017 — 验证：IOS-TC-G01..G04 — 关联：IOS-REQ-001
- [ ] T019 实现 Session 缺失/过期通知节流 — 依赖：T016 — 验证：IOS-TC-G05 — 关联：IOS-REQ-008
- [ ] T020 验证 Loon QUIC/HTTP path — 依赖：T018 — 验证：IOS-TC-G12 — 关联：IOS-REQ-010
- [ ] T021 Loon 真机 E2E 教务 — 依赖：T018..T020 — 验证：IOS-TC-G07..G12 — 关联：AC-IOS-001/002

## Phase M3 — Stash

- [ ] T022 实现 StashAdapter — 依赖：T011..T015 — 验证：Adapter unit — 关联：IOS-REQ-001/011
- [ ] T023 生成 request/response/tile bundles — 依赖：T022 — 验证：bundle scan — 关联：IOS-REQ-011
- [ ] T024 编写 `.stoverride` — 依赖：T023 — 验证：IOS-TC-H01 — 关联：IOS-REQ-001
- [ ] T025 实现 Tile ViewModel — 依赖：T022 — 验证：IOS-TC-H02/H06/H12 — 关联：IOS-REQ-008
- [ ] T026 配置并验证目标域 HTTP/3 fallback — 依赖：T024 — 验证：IOS-TC-H09 — 关联：IOS-REQ-010
- [ ] T027 Stash 真机 E2E 教务 — 依赖：T024..T026 — 验证：IOS-TC-H03..H12 — 关联：AC-IOS-001/002

## Phase M4 — Hardening

- [ ] T028 压测 body size/timeout 并冻结默认值 — 依赖：T021,T027 — 验证：性能记录 — 关联：IOS-NFR-005
- [ ] T029 会话过期/重登验证 — 依赖：T021,T027 — 验证：过期流程 — 关联：AC-IOS-006
- [ ] T030 安全审计 storage/log/request scope — 依赖：T021,T027 — 验证：F 系列 — 关联：IOS-REQ-009
- [ ] T031 bundle dependency/license review — 依赖：T017,T023 — 验证：license manifest — 关联：IOS-REQ-011
- [ ] T032 desktop 全量回归 — 依赖：T030 — 验证：IOS-TC-J01 — 关联：IOS-NFR-009
- [ ] T033 更新长期 docs/ADR/README — 依赖：T032 — 验证：`pnpm run docs:check`
- [ ] T034 创建安装链接、release artifact、rollback 验证 — 依赖：T033 — 验证：IOS-TC-J06/J07 — 关联：IOS-REQ-012
- [ ] T035 完成 verification 并推进 Spec 状态 — 依赖：T034 — 验证：映射表无 Must Pending

## 注意事项

- P0 失败时先更新需求与架构，不用猜测继续实现；
- 真实 Cookie 不得写入 commit、Issue、PR、CI artifact；
- shared core 同一时段应有明确集成责任；
- 新增 AES 依赖必须做许可证、维护性与 bundle 审查，不能只因“能跑”就合入。
