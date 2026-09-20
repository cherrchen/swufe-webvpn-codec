# Dependency Policy

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
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
Version policy: Node side: npm + package-lock.json (committed); Python side: TBD (implementation has not started)
Lockfile:       Node side package-lock.json is committed; Python side TBD (implementation has not started)
Update cadence: TBD (cadence still to be decided)
```

## 4. Security and compliance

- Vulnerability scanning tool: `TBD` (implementation has not started);
- Scan frequency and blocking threshold: `TBD` (implementation has not started);
- Licence allow/deny list: `TBD` (implementation has not started; see also [security/](../security/README.md)).

The project licence is MIT (see [LICENSE](../../LICENSE)).

## 5. Existing and planned dependencies

| Dependency | Purpose | Notes |
| ---------- | ------- | ----- |
| Electron | desktop shell | rationale and cost in [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) |
| mitmproxy | TLS / HTTP2 / MITM, infrastructure-level dependency | see [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md); section 2 of this policy requires an ADR for it |
| pycryptodome | used only by the archived prototype [wrd_codec.py](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/wrd_codec.py) | not a dependency of the current implementation |
| sing-box | later TUN stage | not introduced in phase 1 |
| typescript, tsx, `@types/node` | used only by this repository's documentation check scripts | Node side; no Markdown parser or framework pulled in |
