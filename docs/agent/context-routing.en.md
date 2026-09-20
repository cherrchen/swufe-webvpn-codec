# Context Routing

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [context-routing.md](context-routing.md)

**Purpose**: define which documents to read for which task, replacing "read all of docs every time".
This file is the source of truth for the agent context-loading strategy; the routing table in [AGENTS.md](../../AGENTS.md) is its summary.

---

## 1. Principle

```text
Read the minimum sufficient context,
not the entire repository documentation.
```

Goals:

- cut context-window consumption;
- avoid irrelevant information;
- avoid stale information polluting current judgement;
- reduce hallucination risk.

**Never load all of `docs/` by default.** Classify first, then read what is needed.

## 2. Routing flow

```text
Task
 ↓
AGENTS.md
 ↓
Task Classification
 ├─ Feature
 ├─ Bug
 ├─ Architecture
 ├─ API
 ├─ UI
 ├─ Database
 ├─ Testing
 └─ Documentation
 ↓
Relevant Context
 ↓
(if insufficient) Escalation
```

## 3. Classification and minimum context

| Class | Signal | Minimum reading | Read on demand |
| ----- | ------ | --------------- | -------------- |
| Feature | new/changed user-visible behaviour | `specs/<id>-<name>/spec.md`, `design.md`, `tasks.md` | related requirements, architecture, api |
| Bug | behaviour inconsistent with expectations/spec | the related spec or [components.md](../architecture/components.md) | [testing-strategy.md](../development/testing-strategy.md), [data-flow.md](../architecture/data-flow.md) |
| Architecture | structure, component boundaries, public interfaces, data model, security model | [architecture/overview.md](../architecture/overview.md), [components.md](../architecture/components.md) | [adr/](../architecture/adr/README.md), related spec |
| API | signatures, fields, errors, versions | [api/](../api/README.md), [interfaces.md](../architecture/interfaces.md) | the related spec, contract tests |
| UI | screens and interaction | [ui-ux/](../ui-ux/README.md) | related requirements, the spec's `ui-ux.md` |
| Database | entities, invariants, migrations | [data-model.md](../architecture/data-model.md) | related ADR, the spec's `migration.md` |
| Testing | test strategy or test implementation | [testing-strategy.md](../development/testing-strategy.md), [verification/](../verification/README.md) | the spec's `verification.md` |
| Documentation | document structure or rules | [documentation-rules.md](../development/documentation-rules.md), [docs/README.md](../README.md) | affected documents |

## 4. Load order

```text
1. AGENTS.md                        (always)
2. the matching specs/<id>-<name>/   (when feature/bug related)
3. the documents from the class row  (minimum reading)
4. additional documents on demand     (read-on-demand column)
5. the latest relevant .agents/notes/ note (only when taking over someone's work)
```

At every step you must be able to answer: **which file justifies my current decision?** If none does, escalate.

## 5. Escalation

Widen the reading scope — and say why in the output — when:

| Situation | Action |
| --------- | ------ |
| No matching spec exists | read the related requirements and confirm with the user/owner whether a spec is needed |
| Classification is unclear | read the [docs/README.md](../README.md) index, then reclassify |
| Documents conflict | record the conflict, apply the precedence rules in [documentation-rules.md](../development/documentation-rules.md), escalate the decision |
| The change spans modules | read [components.md](../architecture/components.md) and related ADRs |
| Code and docs disagree | treat current code as fact, record the discrepancy and raise it in the delivery — do not silently edit either side |

## 6. Context declaration on delivery

The agent's delivery summary should include:

```text
Task type:        <classification>
Context read:     <file list>
Uncertainties:    <unconfirmed information / open questions>
Scope excluded:   <what was explicitly not done>
```

This is not ceremony: it lets a human check whether the classification was right and whether a critical document was missed.

## 7. Anti-patterns

| Anti-pattern | Consequence |
| ------------ | ----------- |
| Reading all of `docs/` every time | wasted context, stale-information pollution |
| Reading code but not documents | breaks existing design decisions |
| Reading a spec but not the architecture | breaks layering and dependency direction |
| Treating notes as a source of truth | imports unconfirmed conclusions |
| Reading without citing sources | judgement cannot be reviewed |
