# Dependency Policy

> Status: Draft ｜ Owner: <OWNER> ｜ Last Reviewed: <DATE>
>
> Chinese source of truth: [dependency-policy.md](dependency-policy.md)

**Purpose**: define what must be assessed before adding an external dependency. The goal is **reducing long-term risk**, not banning dependencies.

---

## 1. Questions to answer before adding a dependency

| Dimension | Question | Verdict |
| --------- | -------- | ------- |
| Necessity | Can the standard library or an existing dependency do it? | yes ⇒ don't add |
| Maintenance | Recent releases? Are issues answered? | stalled ⇒ caution |
| License | Compatible with the project licence? | incompatible ⇒ forbidden |
| Security | Unfixed known vulnerabilities? | yes ⇒ forbidden or conditional |
| Size | Acceptable footprint and runtime cost? | mismatch ⇒ evaluate alternatives |
| Transitive deps | How many indirect dependencies come along? | large tree ⇒ caution |
| Native build | Does it need a toolchain or platform-specific binaries? | portability impact ⇒ needs an ADR |
| Fit | Consistent with the existing stack? | second equivalent solution ⇒ needs an ADR |

Adding a functionally equivalent second dependency (e.g. two overlapping utility libraries) is **forbidden** unless an ADR explains why.

## 2. Documentation requirements

| Situation | Where it is recorded |
| --------- | -------------------- |
| Ordinary dependency (passes the table above) | the PR description, with version and rationale |
| Infrastructure-level or hard-to-replace dependency | an ADR (see [adr/README.md](../architecture/adr/README.md)) |
| Change affects user-visible behaviour or performance | the related spec + [non-functional-requirements.md](../requirements/non-functional-requirements.md) |

Template:

```text
Dependency:   <name>
Version:      <version>
Purpose:      <why we need it>
Alternatives: <considered and rejected>
License:      <license>
Risk:         <maintenance / security / size / transitive>
```

## 3. Versions and locking

```text
Version policy: TBD   (exact pinning / semver ranges / other)
Lockfile:       TBD   (committed or not, who updates it)
Update cadence: TBD
```

## 4. Security and compliance

- Vulnerability scanning tool: `TBD`;
- Scan frequency and blocking threshold: `TBD`;
- Licence allow/deny list: `TBD` (see also [security/](../security/README.md)).

## 5. Dependencies of this template

This template (a documentation scaffold) deliberately keeps dependencies minimal: `typescript`, `tsx`, `@types/node`, used only to run the documentation checks.
The check scripts pull in no Markdown parser and no framework.
