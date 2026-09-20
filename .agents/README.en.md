# .agents — agent skills and temporary notes

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: hold platform-neutral agent instructions (skills) and temporary context (notes).
Long-lived facts always live in [docs/](../docs/README.md) and [specs/](../specs/README.md).

```text
.agents/
├── skills/          one directory per skill, each with SKILL.md
└── notes/           temporary context (YYYY-MM-DD-<topic>.md)
```

> This directory is the **temporary and executable part** of Layer 2 (agent context).

## Skills

| Skill | When to use | Output |
| ----- | ----------- | ------ |
| [project-onboarding](skills/project-onboarding/SKILL.md) | an agent enters the project for the first time | a short context summary |
| [create-spec](skills/create-spec/SKILL.md) | requirements are clear and a spec must be created | the five files under `specs/<id>-<name>/` |
| [implement-spec](skills/implement-spec/SKILL.md) | implementing from a spec | code changes + `tasks.md` status updates |
| [verify-change](skills/verify-change/SKILL.md) | a change is complete | a verification conclusion with evidence |
| [update-docs](skills/update-docs/SKILL.md) | code changes affect documentation | document updates, or a "no impact" conclusion |
| [session-handoff](skills/session-handoff/SKILL.md) | session ends, is interrupted, or is handed over | `.agents/notes/YYYY-MM-DD-<topic>.md` |

### Skill authoring conventions

- Every `SKILL.md` is plain Markdown and depends on **no** proprietary format;
- Fixed structure: purpose / when to use / inputs / steps / output / do not;
- Describe only *how*; never copy long-lived facts (link to [docs/](../docs/README.md) instead);
- Tool examples (Claude Code, Codex, Cursor, GitHub Copilot, DeepSeek Harness, …) may appear as compatibility notes but must never become required dependencies.

## Notes

- Use for: agent handoffs, debugging records, research, experiments, temporary design thinking;
- Naming: `YYYY-MM-DD-<topic>.md`;
- Notes are **not a source of truth**: never cite them for architecture, requirements, API contracts or final decisions;
- Long-lived conclusions must be migrated to [docs/](../docs/README.md), [specs/](../specs/README.md) or an ADR, with the destination recorded in the note;
- Details: [notes/README.md](notes/README.md) and [session-handoff.md](../docs/agent/session-handoff.md).

## Not stored here

- Long-lived project facts → [docs/](../docs/README.md)
- Official feature specs → [specs/](../specs/README.md)
- Tool-specific configuration (each tool's own rule files) → decided by the adopting project, but its consistency with this documentation system must be declared in [AGENTS.md](../AGENTS.md)
