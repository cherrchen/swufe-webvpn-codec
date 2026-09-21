# Skill: update-docs

## Purpose

代码变更后判断**哪些长期文档必须同步**，并只做必要更新，避免文档漂移与无意义改写。

## When to use

- 变更触及需求、架构、接口、数据模型、配置或用户可见行为；
- 新增依赖或改变测试方式；
- Spec 完成、需要把结论同步回长期记忆。

## Inputs

- 变更清单；
- [documentation-rules.md](../../../docs/development/documentation-rules.md)（含 Documentation Update Matrix）；
- 相关 Spec 与长期文档。

## Steps

1. 读 [documentation-rules.md](../../../docs/development/documentation-rules.md) 的第 7 节矩阵。
2. 对每一项判断「受影响 / 不受影响」，**逐项写下依据**；不受影响也要在 `verification.md` 或 PR 中说明。
3. 若受影响：
   - 更新对应中文主文档；
   - 同步 `*.en.md` 的**语义**（不是逐字翻译）；
   - 若新增/移动/重命名文件：更新 [docs/README.md](../../../docs/README.md) 索引与全仓库链接。
4. 判断是否需要 ADR：
   - 核心技术栈、公共接口、数据模型、安全模型、跨模块架构、重要基础设施、难逆决策 ⇒ 是；
   - 普通小型实现 ⇒ 否。
5. 若 Spec 结论改变了长期事实：更新 [docs/](../../../docs/README.md) 或 ADR，并在 Spec 中引用（**不复制**）。
6. 运行 `pnpm run docs:check` 并确认通过。
7. 在交付说明中列出：更新了哪些文档、为什么其余不需要更新。

## Output

- 更新后的长期文档（中英配对）；
- 索引/链接修正；
- 结论说明：更新项 + 未更新项及理由。

## Do not

- 不要因为「看起来更整齐」而重写整个文档；
- 不要把同一条事实复制到多个文档（One Fact, One Source of Truth）；
- 不要把临时结论、调试信息、聊天内容写入长期文档；
- 不要只改中文版而漏掉 `.en.md`（或反之）；
- 不要在没有依据的情况下新增文档、组件、接口或 ADR。
