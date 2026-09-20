# .agents —— Agent Skills 与临时 Notes

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>

**用途**：存放与具体 AI 平台无关的 Agent 指令（Skills）和临时上下文（Notes）。
**中文版本是 Source of Truth**；英文版见各自 `.en.md`（`.agents/notes/**` 不强制双语，见 [documentation-rules.md](../docs/development/documentation-rules.md)）。

```text
.agents/
├── skills/          每个技能一个目录，含 SKILL.md
└── notes/           临时上下文（YYYY-MM-DD-<topic>.md）
```

> 本目录属于 Layer 2（Agent Context）的**临时与可执行部分**；长期事实一律在 [docs/](../docs/README.md) 与 [specs/](../specs/README.md)。

## Skills

| Skill | 何时使用 | 产物 |
| ----- | -------- | ---- |
| [project-onboarding](skills/project-onboarding/SKILL.md) | 新 Agent 首次进入项目 | 简短 Context Summary |
| [create-spec](skills/create-spec/SKILL.md) | 需求已明确，需要建立 Spec | `specs/<id>-<name>/` 五个文件 |
| [implement-spec](skills/implement-spec/SKILL.md) | 按 Spec 实现 | 代码改动 + `tasks.md` 状态更新 |
| [verify-change](skills/verify-change/SKILL.md) | 变更完成后 | 验证结论（含证据） |
| [update-docs](skills/update-docs/SKILL.md) | 代码变更影响文档 | 文档更新或「无影响」结论 |
| [session-handoff](skills/session-handoff/SKILL.md) | Session 结束/中断/转交 | `.agents/notes/YYYY-MM-DD-<topic>.md` |

### Skill 编写约定

- 每个 `SKILL.md` 使用普通 Markdown，**不依赖**任何平台专有格式；
- 结构固定：Purpose / When to use / Inputs / Steps / Output / Do not；
- 只写「怎么做」，不复制长期事实（引用 [docs/](../docs/README.md) 路径）；
- 平台示例（Claude Code / Codex / Cursor / GitHub Copilot / DeepSeek Harness 等）只能作为兼容性说明，不得成为必需依赖。

## Notes

- 用途：Agent 交接、调试记录、调研、实验、临时设计思考；
- 命名：`YYYY-MM-DD-<topic>.md`；
- **Notes 不是 Source of Truth**：不得作为架构、需求、API 契约或最终决策的依据；
- 形成长期结论后必须迁移到 [docs/](../docs/README.md)、[specs/](../specs/README.md) 或 ADR，并在 note 中标注去向；
- 详见 [notes/README.md](notes/README.md) 与 [session-handoff.md](../docs/agent/session-handoff.md)。

## 不放在这里的内容

- 长期项目事实 → [docs/](../docs/README.md)
- Feature 的正式 Spec → [specs/](../specs/README.md)
- 平台专有配置（如各工具自身的规则文件）→ 由使用方自行决定，且必须在 [AGENTS.md](../AGENTS.md) 中声明其与文档系统的一致性
