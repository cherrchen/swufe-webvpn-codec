# Verification: iOS Proxy Client Plugins

> Spec ID: 003  
> Status: Draft  
> Owner: cherrchen  
> Last Updated: 2026-09-24

## 映射表

| Requirement | Verification | Status |
| --- | --- | --- |
| IOS-REQ-001 | G01/H01 + disable/update cases | Pending |
| IOS-REQ-002 | I01/I03 + G07/H04 | Pending |
| IOS-REQ-003 | C01..C10 + I02/I04 | Pending |
| IOS-REQ-004 | B01..B09 | Pending |
| IOS-REQ-005 | A01..A09 | Pending |
| IOS-REQ-006 | D01..D09 | Pending |
| IOS-REQ-007 | E01..E11 | Pending |
| IOS-REQ-008 | H02/H06/H12 + Loon notification cases | Pending |
| IOS-REQ-009 | F01..F08 | Pending |
| IOS-REQ-010 | G12/H09 | Pending |
| IOS-REQ-011 | bundle/version smoke | Pending |
| IOS-REQ-012 | G11/H11/J06 | Pending |
| IOS-NFR-001 | A09 | Pending |
| IOS-NFR-002 | F04 | Pending |
| IOS-NFR-003 | D09 | Pending |
| IOS-NFR-004 | architecture/code review | Pending |
| IOS-NFR-005 | request/body policy review + perf | Pending |
| IOS-NFR-006 | expired flow | Pending |
| IOS-NFR-007 | F01..F03 | Pending |
| IOS-NFR-008 | real-device matrix | Pending |
| IOS-NFR-009 | J01 | Pending |

Status：`Pending` / `Passed` / `Failed` / `N/A`。

## 验收标准覆盖

| Acceptance Criteria | 对应验证项 | Status |
| --- | --- | --- |
| AC-IOS-001 | I01..I06 + 至少一宿主 E2E | Pending |
| AC-IOS-002 | G09/H07 | Pending |
| AC-IOS-003 | A09 | Pending |
| AC-IOS-004 | D03/D09 | Pending |
| AC-IOS-005 | B03/B04 | Pending |
| AC-IOS-006 | H12 + Loon equivalent | Pending |
| AC-IOS-007 | F01..F08 | Pending |
| AC-IOS-008 | G01/G10/G11 + H01/H10/H11 | Pending |
| AC-IOS-009 | J01 | Pending |
| AC-IOS-010 | I01..I06 | Pending |

## 执行的命令与结果

尚未执行。本文件当前是实施前的验证矩阵，不得预填 `Passed`。

## 手工验证步骤

完整步骤见 [test-plan.md](test-plan.md) 的 P0/E2E 模板。

## 边界与异常场景

见 [test-cases.md](test-cases.md) B/C/D/E/F 系列。

## 兼容性

| 维度 | 结论 | 依据 |
| --- | --- | --- |
| desktop | Pending | J01 |
| Loon | Pending | G 系列 |
| Stash | Pending | H 系列 |
| storage schema | Pending | C08/C09/G11/H11 |

## 安全

| 检查项 | 结论 | 依据 |
| --- | --- | --- |
| 不存账号密码/MFA | Pending | F04 |
| Session 不进日志/通知 | Pending | F01..F03 |
| 非 gateway 不注入 Session | Pending | D09 |
| authserver 不持久化认证 Cookie | Pending | C03 |
| MitM scope 最小化 | Pending | 配置审查 + 真机 |

## 文档同步

当前 ZIP 是 Feature 设计草案。并入实现 PR 时，长期 `docs/**` 的中英双语同步仍为 Pending。

## 未验证 / 无法验证项

| 项 | 原因 | 已尝试 | 需要的动作 |
| --- | --- | --- | --- |
| openUrl App 内呈现 | 公开 API 不保证具体容器 | 尚未真机 | P0 |
| in-app web → Script 可观察性 | 公开 API 不保证 | 尚未真机 | P0 |
| 最小 Session Cookie 集 | 厂商运行时事实 | 尚未真机 | P0 |
| Loon 局部 QUIC 策略 | 需实际配置验证 | 尚未真机 | M2 |
| body size/time limit | 宿主运行时限制 | 尚未压测 | M4 |

## 结论

- [ ] 映射表无 Must `Pending`
- [ ] 实际执行命令/真机证据已记录
- [ ] 安全红线全部通过
- [ ] 长期文档与 ADR 已同步
- [ ] Spec 状态可推进到 `Verified`

当前结论：**不可推进到 Verified**；这是实施前的完整验证计划。
