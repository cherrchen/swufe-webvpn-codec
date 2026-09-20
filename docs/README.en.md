# Documentation Index

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> The Chinese version is the source of truth: [README.md](README.md).

`docs/` is **Layer 1 — Project Knowledge**: long-lived project facts.
Nothing here is deleted when a single feature ships; temporary content belongs in [.agents/notes/](../.agents/notes/README.md).

## Navigation

| Directory | One-line purpose |
| --------- | ---------------- |
| [overview/](overview/project-overview.md) | What the project is, why it exists, goals/non-goals, glossary |
| [requirements/](requirements/README.md) | Product, functional and non-functional requirements |
| [architecture/](architecture/README.md) | Architecture overview, components, data flow, data model, interfaces, ADRs |
| [api/](api/README.md) | External and internal interface contracts |
| [ui-ux/](ui-ux/README.md) | Interface structure, interaction and experience conventions |
| [development/](development/README.md) | Workflow, coding conventions, testing strategy, documentation rules, dependency policy |
| [agent/](agent/README.md) | Agent workflow, context routing, session handoff |
| [verification/](verification/README.md) | Verification strategy and definition of done |
| [security/](security/README.md) | Trust boundaries, authn/authz, secrets, input handling, privacy |
| [operations/](operations/README.md) | Environments, configuration, deployment, observability, backup and recovery |
| [planning/](planning/README.md) | Roadmap and milestones |
| [archive/](archive/README.md) | Archived historical design material |

Other repository entry points: [AGENTS.md](../AGENTS.md) (first entry point for agents), [README.md](../README.md) (project positioning, scope and document system), [CONTRIBUTING.md](../CONTRIBUTING.md) (contribution flow), [specs/](../specs/README.md) (feature specs).

## Reading principle

```text
Read the minimum sufficient context,
not the entire repository documentation.
```

Classify the task first (feature / bug / architecture / API / UI / database / testing / documentation), then read the matching documents from
[docs/agent/context-routing.md](agent/context-routing.md). **Never load all of `docs/` by default.**

## Rules summary

- **Bilingual**: `foo.md` (Chinese, source of truth) + `foo.en.md` (English, semantically in sync). Exceptions: see
  [documentation-rules.md](development/documentation-rules.md).
- **One fact, one source of truth**: define once, reference elsewhere.
- **Doc levels**: Level A (requirements / architecture / api / ADR / spec), Level B (guidance: development / agent / operations),
  Level C (temporary: notes / research / experiments).
- **Metadata**: long-lived design documents should start with `Status / Owner / Last Reviewed`; plain READMEs need not.
- **Mermaid**: only when a diagram beats prose (architecture, data flow, state machines, sequences, dependencies, agent workflow). No decoration.

## Not stored here

- Temporary debug notes, chat transcripts, experiment results → [.agents/notes/](../.agents/notes/README.md)
- Per-feature design and tasks → [specs/](../specs/README.md)
- Tool configuration for coding style → repository root configuration files
