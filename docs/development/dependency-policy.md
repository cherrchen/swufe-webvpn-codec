# 依赖策略

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20

**用途**：规定引入外部依赖前的评估要求。目标是**降低长期风险**，不是禁止依赖。

---

## 1. 引入依赖前必须回答

| 维度 | 问题 | 判定 |
| ---- | ---- | ---- |
| Necessity | 标准库 / 现有依赖能否解决？ | 能 ⇒ 不加 |
| Maintenance | 最近是否有版本发布？Issue 是否被响应？ | 停滞 ⇒ 谨慎 |
| License | 许可证是否与项目兼容？ | 不兼容 ⇒ 禁止 |
| Security | 是否有未修复的已知漏洞？ | 有 ⇒ 禁止或有条件使用 |
| Size | 体积与运行时开销是否可接受？ | 量级不符 ⇒ 评估替代 |
| Transitive deps | 引入多少间接依赖？ | 树过大 ⇒ 谨慎 |
| Native build | 是否需要编译工具链 / 平台特定二进制？ | 影响可移植性 ⇒ 需 ADR |
| Fit | 与既有技术栈是否一致？ | 引入第二套等价方案 ⇒ 需 ADR |

**禁止**引入第二套功能等价的依赖（例如两个功能重叠的工具库），除非有 ADR 说明理由。

## 2. 记录要求

| 情况 | 记录位置 |
| ---- | -------- |
| 普通依赖（满足上表全部要求） | PR 描述中的依赖说明（含版本与理由） |
| 引入基础设施级依赖 / 难以替换的依赖 | ADR（见 [adr/README.md](../architecture/adr/README.md)） |
| 依赖变更影响用户可见行为或性能 | 相关 Spec + [non-functional-requirements.md](../requirements/non-functional-requirements.md) |

模板：

```text
Dependency:   <name>
Version:      <version>
Purpose:      <why we need it>
Alternatives: <considered and rejected>
License:      <license>
Risk:         <maintenance / security / size / transitive>
```

## 3. 版本与锁定

```text
Version policy: Node 侧：npm + package-lock.json（已提交）；Python 侧：TBD（实现未开始）
Lockfile:       Node 侧 package-lock.json 已提交；Python 侧 TBD（实现未开始）
Update cadence: TBD（更新节奏待决策）
```

## 4. 安全与合规

- 依赖漏洞扫描工具：`TBD`（实现未开始）；
- 扫描频率与阻断阈值：`TBD`（实现未开始）；
- 许可证白名单 / 黑名单：`TBD`（实现未开始；可参考 [security/](../security/README.md)）。

项目许可为 MIT（见 [LICENSE](../../LICENSE)）。

## 5. 本项目既有与计划依赖

| 依赖 | 用途 | 说明 |
| ---- | ---- | ---- |
| Electron | 桌面壳 | 理由与代价见 [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) |
| mitmproxy | TLS / HTTP2 / MITM 基础设施级依赖 | 见 [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)；按本策略第 2 节须记 ADR |
| pycryptodome | 仅归档原型 [wrd_codec.py](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/wrd_codec.py) 使用 | 不作为当前实现依赖 |
| sing-box | 后续 TUN 阶段 | 第一期不引入 |
| typescript、tsx、`@types/node` | 仅用于本仓库文档检查脚本 | Node 侧，不引入 Markdown parser 或框架 |
