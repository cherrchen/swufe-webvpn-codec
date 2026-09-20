# 开发（Development）

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：本目录是**开发实践规范**（Level B — Guidance）的集合：流程、编码规范、测试策略、文档规则、依赖策略。
它约束「怎么做」，不定义「做什么」（→ [requirements/](../requirements/README.md)）或「是什么」（→ [architecture/](../architecture/README.md)）。

## 文件

| 文件 | 回答的问题 | 什么时候必须读 |
| ---- | ---------- | -------------- |
| [development-workflow.md](development-workflow.md) | 一个变更从想法到合并走哪些步骤 | 开始任何工作前 |
| [coding-conventions.md](coding-conventions.md) | 代码如何组织与命名 | 写代码前 |
| [testing-strategy.md](testing-strategy.md) | 测试分层、覆盖要求、如何运行 | 写测试前 |
| [documentation-rules.md](documentation-rules.md) | 文档层级、语言、同步与防污染规则 | 改文档或改行为前 |
| [dependency-policy.md](dependency-policy.md) | 什么情况下可以引入依赖 | 新增依赖前 |

## 规范冲突时的优先级

```text
更具体的规范  >  更一般的规范
项目已确认的 ADR  >  本目录的一般性建议
需求与非功能约束  >  便利性偏好
```

规范之间出现冲突时，**不要自行选择**：在 PR 中记录冲突并请求裁决，然后更新本目录，使其只有一个结论。

## 相关入口

- Agent 专用规则：[AGENTS.md](../../AGENTS.md)、[docs/agent/](../agent/README.md)
- 贡献流程摘要：[CONTRIBUTING.md](../../CONTRIBUTING.md)
- 验证与完成标准：[docs/verification/](../verification/README.md)
