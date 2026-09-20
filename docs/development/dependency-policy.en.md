# Dependency Policy

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
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
Version policy: Node side: npm + package-lock.json (committed); Python side: uv + uv.lock (committed; `uv sync` installs, `uv sync --frozen` verifies the lock is consistent)
Lockfile:       Node side package-lock.json is committed; Python side uv.lock is committed; the interpreter version is pinned by .python-version (3.13)
Update cadence: TBD (cadence still to be decided)
```

## 4. Security and compliance

- Vulnerability scanning tool: `TBD` (not adopted this phase; both the Node devDependencies and the Python side are pinned in `uv.lock`);
- Scan frequency and blocking threshold: `TBD` (same as above);
- Licence allow/deny list: `TBD` (not adopted this phase; every added dependency's licence is recorded per section 2, see also [security/](../security/README.md)).

The project licence is MIT (see [LICENSE](../../LICENSE)).

## 5. Existing and planned dependencies

| Dependency | Purpose | Notes |
| ---------- | ------- | ----- |
| Electron | desktop shell | rationale and cost in [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) |
| mitmproxy | TLS / HTTP2 / MITM, infrastructure-level dependency | see [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md); section 2 of this policy requires an ADR for it. Since M1 it is a **runtime dependency**: the sidecar drives it through `mitmproxy.tools.main.mitmdump`, and it hosts the bridge and control plane (`swufe_bridge/sidecar.py`); its dedicated confdir also carries the MITM CA |
| cryptography | AES-128-CFB128 codec (WRD hostname token) | newly added as a direct dependency in M1; it was already pulled in transitively by mitmproxy, and declaring it directly pins the API the codec uses (`swufe_bridge/wrd_codec.py`) |
| pytest | Python-side test framework (L0/L1/L2) | newly added in M1, dev dependency group (`[dependency-groups] dev`) |
| hatchling | Python package build backend | newly added in M1, build-time dependency, not present at runtime |
| pycryptodome | used only by the archived prototype [wrd_codec.py](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/wrd_codec.py) | not a dependency of the current implementation; the M1 codec uses `cryptography`'s AES-CFB128 (equivalent to the prototype's `segment_size=128`, guaranteed by the TC-A02 gate vector) |
| sing-box | later TUN stage | not introduced in phase 1 |
| typescript, tsx, `@types/node` | used only by this repository's documentation check scripts | Node side; no Markdown parser or framework pulled in |

### Dependency records (added in M1)

```text
Dependency:   cryptography
Version:      >=42 (uv.lock pins 48.0.1)
Purpose:      AES-128-CFB128 (token encryption/decryption) for the WRD codec
Alternatives: pycryptodome (used by the archived prototype; this policy forbids a second equivalent solution, and it would be an extra runtime dependency)
License:      Apache-2.0 / BSD-3-Clause (dual-licensed)
Risk:         no new platform binary (pulled in transitively by mitmproxy, already inside this project's dependency tree)
```

```text
Dependency:   pytest
Version:      >=8 (uv.lock pins 9.1.1)
Purpose:      test runner for L0/L1/L2
Alternatives: unittest (standard library; but parameterisation and fixture organisation cost more, and pytest is already the test stack inside mitmproxy's dependency tree)
License:      MIT
Risk:         dev dependency only, does not affect release artifacts
```

```text
Dependency:   hatchling
Version:      build backend (resolved by uv, see uv.lock)
Purpose:      building the swufe_bridge package (editable installs and future distribution)
Alternatives: setuptools / flit (hatchling is uv's default path with the least configuration)
License:      MIT
Risk:         build-time dependency only, not present at runtime
```
