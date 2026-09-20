# Technical Design: <feature-name>

> Spec ID: <id>
> Status: Draft
> Owner: <OWNER>
> Last Updated: <DATE>

> 本文件回答 **How**：采用什么方案实现 [spec.md](spec.md) 的需求，影响哪些既有结构，有什么代价与风险。
> **不写**需求定义（→ [spec.md](spec.md)）、任务拆解（→ [tasks.md](tasks.md)）、长期架构事实（→ [docs/architecture/](../../docs/architecture/README.md)）。
> 若涉及难以逆转的决策 ⇒ 建立 ADR（[adr/README.md](../../docs/architecture/adr/README.md)），此处只引用。

## Context

TBD —— 与方案相关的现状：涉及的组件、既有约束、相关 Spec / ADR（给出路径）。

## Proposed Solution

TBD —— 方案描述：整体思路、关键步骤、为什么可行。
若图比文字清晰，可用 Mermaid；图必须有文字说明。

## Architecture Impact

| 影响对象 | 是否变化 | 说明 | 需同步的文档 |
| -------- | -------- | ---- | ------------ |
| 组件/分层 | TBD | TBD | [components.md](../../docs/architecture/components.md) |
| 数据流 | TBD | TBD | [data-flow.md](../../docs/architecture/data-flow.md) |
| 接口 | TBD | TBD | [interfaces.md](../../docs/architecture/interfaces.md) |
| 数据模型 | TBD | TBD | [data-model.md](../../docs/architecture/data-model.md) |
| 是否需要 ADR | TBD | 理由 | ADR-XXXX |

## Components

| 组件 | 变更类型（新增/修改/删除） | 职责变化 |
| ---- | -------------------------- | -------- |
| TBD | TBD | TBD |

## Data Flow

TBD —— 数据从哪来、经过什么、到哪去；失败与重试路径。

## API Changes

| 接口 | 变更 | 兼容性 | 文档位置 |
| ---- | ---- | ------ | -------- |
| TBD | 新增/修改/删除 | 兼容 / 破坏性 | [docs/api/](../../docs/api/README.md) |

## Data Model Changes

| 实体 | 变更 | 迁移需求 | 回滚方式 |
| ---- | ---- | -------- | -------- |
| TBD | TBD | TBD | TBD |

## UI/UX Changes

TBD —— 界面与交互变化；无 UI 影响时写 `无`，并说明判断依据。

## Security Considerations

| 维度 | 影响 | 处理 |
| ---- | ---- | ---- |
| 信任边界 | TBD | TBD |
| 认证 / 授权 | TBD | TBD |
| 输入校验 | TBD | TBD |
| 密钥 / 敏感数据 | TBD | TBD |
| 依赖风险 | TBD | TBD |

> 相关长期事实见 [docs/security/](../../docs/security/README.md)。

## Performance Considerations

TBD —— 预期负载、复杂度、可能的瓶颈与测量方式；不适用时写 `无` 并说明。

## Compatibility

| 维度 | 影响 | 处理 |
| ---- | ---- | ---- |
| 向后兼容 | TBD | TBD |
| 数据兼容 | TBD | TBD |
| 配置兼容 | TBD | TBD |
| 运行环境 | TBD | TBD |

## Migration

TBD —— 是否需要迁移；步骤、顺序、可重入性、失败处理；无迁移时写 `不适用`。

## Alternatives Considered

| 备选方案 | 优点 | 缺点 | 未采纳原因 |
| -------- | ---- | ---- | ---------- |
| TBD | TBD | TBD | TBD |

## Risks

| ID | 风险 | 可能性 | 影响 | 缓解 | 对应任务 |
| -- | ---- | ------ | ---- | ---- | -------- |
| R-001 | TBD | TBD | TBD | TBD | T00x |

## Open Questions

| ID | 问题 | 影响 | 状态 |
| -- | ---- | ---- | ---- |
| DQ-001 | TBD | TBD | Open |
