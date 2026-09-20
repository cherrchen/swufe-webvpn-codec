# Coding Conventions

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [coding-conventions.md](coding-conventions.md)

**Purpose**: align code organisation, naming and readability so that output from different authors (including coding agents) looks consistent.
**Do not write**: formatter configuration (that is repository config), architectural layering (→ [architecture/](../architecture/README.md)).

> This template assumes no programming language. The entries below must be replaced with the adopting project's real conventions;
> until then they stay `TBD` — **do not** invent language-specific rules.

---

## 1. Language and versions

```text
Primary language:  TBD
Language version:  TBD
Package manager:   TBD
Formatter:         TBD
Linter:            TBD
```

## 2. Directory and module organisation

| Rule | Description |
| ---- | ----------- |
| TBD | e.g. one module per directory; public surface in the entry file |

## 3. Naming

| Object | Convention |
| ------ | ---------- |
| Files | TBD |
| Types | TBD |
| Functions | TBD |
| Variables | TBD |
| Constants | TBD |

## 4. Style essentials

- Follow existing repository patterns; two equivalent conventions side by side are **not allowed** (see the precedence rules in [README.md](README.md)).
- Avoid unreadable abbreviations; avoid abstractions used once.
- Comments explain *why*, never restate *what*.
- Public APIs must carry doc comments (format: TBD).

## 5. Error handling

| Scenario | Requirement |
| -------- | ----------- |
| Input validation | TBD |
| Recoverable error | TBD |
| Unrecoverable error | TBD |
| Never swallow errors | silent `catch`/ignored return codes are forbidden unless a comment states the reason |

## 6. Dependencies and imports

- Dependency direction must match [architecture/components.md](../architecture/components.md);
- No circular dependencies;
- Read [dependency-policy.md](dependency-policy.md) before adding a dependency.

## 7. Change discipline

- No refactors unrelated to the task;
- Do not delete code of unknown purpose;
- Changing public behaviour requires syncing tests and documentation;
- "While I'm here" improvements are scope creep and need their own task.

## 8. Local check commands

```text
Format:  TBD
Lint:    TBD
Type:    TBD
Test:    TBD
```

> This template's own documentation check is `npm run docs:check`; adopting projects replace these with their own commands.
