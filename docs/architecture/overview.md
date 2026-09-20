# 架构总览

> Status: TBD ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：用最少的篇幅说明系统的整体形态与边界，使读者在 5 分钟内建立正确的系统心智模型。
**不写**：组件细节（→ [components.md](components.md)）、数据字段（→ [data-model.md](data-model.md)）、接口字段（→ [interfaces.md](interfaces.md)、[docs/api/](../api/README.md)）。

---

## 系统形态

```text
风格:      TBD   （单体 / 分层 / 模块化单体 / 客户端-服务端 / 事件驱动 / 其它）
部署单元:  TBD
主要语言:  TBD
运行时:    TBD
```

## 上下文图（System Context）

```mermaid
flowchart LR
    U["用户 / 调用方"] --> S["<PROJECT_NAME>"]
    S --> X["外部系统 / 依赖"]
```

> 无外部系统时删除右侧节点；只在确实存在交互时保留。

## 分层 / 模块概览

| 层 / 模块 | 职责 | 允许依赖 | 详见 |
| --------- | ---- | -------- | ---- |
| TBD | TBD | TBD | [components.md](components.md) |

## 关键约束

| ID | 约束 | 来源 | 影响 |
| -- | ---- | ---- | ---- |
| C-001 | TBD | NFR-001 / ADR-XXXX | TBD |

## 关键决策索引

技术决策不在此处展开，只列出指向 ADR 的索引：

| 决策 | ADR |
| ---- | --- |
| TBD | [adr/template.md](adr/template.md) |

## 已知的架构风险

| 风险 | 影响 | 缓解方式 | 状态 |
| ---- | ---- | -------- | ---- |
| TBD | TBD | TBD | Open |
