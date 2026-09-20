# 文档索引（Documentation Index）

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> 中文版本是 Source of Truth；英文版本见 [README.en.md](README.en.md)。

`docs/` 是本仓库的 **Layer 1 — Project Knowledge**：长期存在的项目事实。
这里的内容不随单个 Feature 完成而删除；临时内容请放 [.agents/notes/](../.agents/notes/README.md)。

## 导航

| 目录 | 一句话用途 |
| ---- | ---------- |
| [overview/](overview/project-overview.md) | 项目是什么、为什么存在、目标与非目标、术语表 |
| [requirements/](requirements/README.md) | 产品需求、功能需求、非功能需求 |
| [architecture/](architecture/README.md) | 架构总览、组件、数据流、数据模型、接口、ADR |
| [api/](api/README.md) | 对外/对内接口契约 |
| [ui-ux/](ui-ux/README.md) | 界面结构、交互与体验规范 |
| [development/](development/README.md) | 开发流程、编码规范、测试策略、文档规则、依赖策略 |
| [agent/](agent/README.md) | Agent 工作流、上下文路由、Session 交接 |
| [verification/](verification/README.md) | 验证策略与完成标准 |
| [security/](security/README.md) | 信任边界、认证授权、密钥、输入与隐私 |
| [operations/](operations/README.md) | 环境、配置、部署、可观测性、备份与恢复 |
| [planning/](planning/README.md) | Roadmap 与里程碑 |
| [archive/](archive/README.md) | 已归档的历史设计资料 |

仓库根部的其它入口：[AGENTS.md](../AGENTS.md)（Agent 第一入口）、[README.md](../README.md)（项目定位、范围与文档体系）、[CONTRIBUTING.md](../CONTRIBUTING.md)（贡献流程）、[specs/](../specs/README.md)（Feature Spec）。

## 阅读原则

```text
Read the minimum sufficient context,
not the entire repository documentation.
```

先分类任务（Feature / Bug / Architecture / API / UI / Database / Testing / Documentation），再按
[docs/agent/context-routing.md](agent/context-routing.md) 读取相关文档；**不要默认加载整个 `docs/`**。

## 文档规则摘要

- **中英双语**：`foo.md`（中文，Source of Truth）+ `foo.en.md`（英文，语义同步）；例外见
  [documentation-rules.md](development/documentation-rules.md)。
- **One Fact, One Source of Truth**：同一事实只在一处定义，其它文档引用而不是复制。
- **文档层级**：Level A（Source of Truth：requirements / architecture / api / ADR / spec）、
  Level B（Guidance：development / agent / operations）、Level C（Temporary：notes / research / experiments）。
- **状态元数据**：长期设计文档建议在开头写 `Status / Owner / Last Reviewed`；普通 README 不强制。
- **Mermaid**：只有图比文字更清楚时才使用（架构、数据流、状态机、时序、依赖、Agent 工作流）；不做装饰性绘图。

## 本目录不存放什么

- 临时调试记录、聊天记录、实验结论 → [.agents/notes/](../.agents/notes/README.md)
- 单个 Feature 的设计与任务 → [specs/](../specs/README.md)
- 代码风格的工具配置 → 仓库根部的配置文件
