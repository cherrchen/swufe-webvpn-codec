# CONTRIBUTING.md

> Contribution entry point for human developers and coding agents. The Chinese version is the source of truth: [CONTRIBUTING.md](CONTRIBUTING.md).
> Coding agents: read [AGENTS.md](AGENTS.md) first.

The full workflow and branching policy live in [docs/development/development-workflow.md](docs/development/development-workflow.md).
Code/document consistency requirements live in [docs/development/documentation-rules.md](docs/development/documentation-rules.md).

---

## 1. Before you start

1. Classify the change: feature / bug / architecture / API / UI / documentation.
2. Read the minimum sufficient context per [docs/agent/context-routing.md](docs/agent/context-routing.md).
3. Check whether `specs/<id>-<name>/` already exists for this work:
   - feature-sized changes **require a spec** (see [specs/README.md](specs/README.md));
   - ordinary bugs may use the simplified flow below.

## 2. Recommended flow

```text
Feature:  Idea → Issue → Spec → Design → Plan → Tasks → Implementation
          → Verification → Documentation Sync → Review → Complete
Bug:      Bug → Reproduce → Root Cause → Fix → Test → Documentation Impact
```

The workflow itself (per-stage exit criteria, change tiers) is defined only in
[docs/development/development-workflow.md](docs/development/development-workflow.md) and is not repeated here.

Rules:

- feature-sized changes **require a spec** (see [specs/README.md](specs/README.md));
- issues are for tracking and discussion and never replace a spec;
- bugs that change public behaviour, the data model or the security model escalate to the spec flow.

## 3. Pull request requirements

Use [.github/pull_request_template.md](.github/pull_request_template.md). It must contain:

- summary, related spec, changes, verification;
- documentation impact (what changed, or why nothing had to);
- architecture impact (ADR needed?);
- breaking changes;
- checklist (tests, spec, docs, ADR, no unrelated scope).

## 4. Definition of done

Before merge, consider: implementation, tests, verification, documentation, compatibility, security, spec status.
The per-item requirements and project override live in [docs/verification/verification-strategy.md](docs/verification/verification-strategy.md) (source of truth) and are not copied here.

## 5. When an ADR is mandatory

Triggers are defined only in [docs/architecture/adr/README.md](docs/architecture/adr/README.md) (core stack, public interfaces, data model, security model, cross-module architecture, significant infrastructure, hard-to-reverse decisions). Do not overuse ADRs for routine small implementations.

## 6. Local checks before submitting

```bash
pnpm run docs:check
```

Branch naming and commit message conventions are project-local and defined in [docs/development/development-workflow.md](docs/development/development-workflow.md).
CI runs the same scripts ([.github/workflows/docs-check.yml](.github/workflows/docs-check.yml)).

## 7. Documentation language

Long-lived documents are Chinese primary with an English `*.en.md` counterpart; Chinese is the source of truth. Language rules, exceptions and single-language paths are defined only in [docs/development/documentation-rules.md](docs/development/documentation-rules.md).
