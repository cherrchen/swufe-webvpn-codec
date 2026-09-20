# M0: 预研（Pre-research）

> Status: Done
> Owner: cherrchen
> Target: TBD（原包未定义日期）

## 目标

冻结 Phase 1 的事实基础，使实现阶段不再返工：

- **WRD codec 已验证**：编解码结论与已验证原型 `wrd_codec.py` 的向量一致（含 authserver / jwxt 样本，NFR-002）；
- **需求规格已完整**：目标与非目标、产品/功能/非功能需求、UI/UX、技术设计、架构选型、接口、数据模型、测试计划与用例；
- **文档包已归档**：原始文档包逐字保留，作为历史与出处证据。

## 包含的 Specs

| Spec | 状态 | 依赖 |
| ---- | ---- | ---- |
| —（M0 不归属 Spec；其产出是 [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) 的需求输入） | — | — |

## 退出条件

- [x] WRD codec 验证通过：算法结论与原型向量一致（TC-A01..TC-A05 覆盖的样本可用；默认 `key=iv=wrdvpnisthebest!`，配置可覆盖）
- [x] Phase 1 需求规格已定稿：G-001..G-004、NG-001..NG-008、PR-001..PR-005、REQ-001..REQ-011、NFR-001..NFR-007
- [x] 架构与接口事实已固化：组件/数据流/数据模型/接口、ADR-0001..ADR-0005、桥状态机与错误码
- [x] 测试计划与用例表（TC-A01..TC-H02）、WBS、里程碑、风险登记册（R1..R6）已成文
- [x] 文档包已归档：[docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/README.md)

## 风险

| 风险 | 影响 | 应对 |
| ---- | ---- | ---- |
| R5 学校政策限制自动化（低/高） | 若校方不允许此访问方式，主路径不可交付 | 私用优先、文档声明用途边界（仅服务有权使用 WebVPN 的用户）；必要时降级为手动转换 |
| R6 默认密钥轮换（低/中） | codec 验证所依赖的默认 `key`/`iv` 失效，URL 改写与解码失败 | 默认内置 + 配置覆盖（见 [ADR-0005](../../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)），预留读取 portal 的扩展位 |

## 完成记录

- 完成时间：2026-09-20；
- 证据：归档原包 [docs/archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/README.md)（原始 zip 逐字副本，16 个文件，含 `99-appendix/wrd_codec.py`）；
- 遗留问题：无（实现尚未开始；原包未定义日历时间，故后续里程碑 `Target` 为 TBD）。
