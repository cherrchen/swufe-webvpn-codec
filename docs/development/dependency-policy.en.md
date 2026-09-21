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
Version policy: Node side: pnpm 11 workspaces (version pinned by `packageManager` in the root package.json; workspace membership is defined by `packages` in `pnpm-workspace.yaml`) + the root `pnpm-lock.yaml` (committed); Python side: uv + bridges/python/uv.lock (committed; `uv sync --directory bridges/python` installs, `uv sync --frozen --directory bridges/python` verifies the lock is consistent)
Lockfile:       Node side: the root `pnpm-lock.yaml` is committed (a single lockfile covering the repository root and apps/desktop/); install with `pnpm install`, verify it is up to date with `pnpm install --frozen-lockfile`; Python side bridges/python/uv.lock is committed; the interpreter version is pinned by bridges/python/.python-version (3.13)
Update cadence: TBD (cadence still to be decided)
```

### 3.1 Install-script approval (pnpm `allowBuilds`)

`allowBuilds` in `pnpm-workspace.yaml` lists, one by one, the dependencies whose **install scripts may run** (currently `electron` and `esbuild`); a dependency with install scripts that is not listed makes `pnpm install` fail with `ERR_PNPM_IGNORED_BUILDS` — reviewing it and adding it to `allowBuilds` explicitly is the required step before the install can proceed.

## 4. Security and compliance

- Vulnerability scanning tool: `TBD` (not adopted this phase; both the Node devDependencies and the Python side are pinned in `bridges/python/uv.lock`);
- Scan frequency and blocking threshold: `TBD` (same as above);
- Licence allow/deny list: `TBD` (not adopted this phase; every added dependency's licence is recorded per section 2, see also [security/](../security/README.md)).

The project licence is MIT (see [LICENSE](../../LICENSE)).

## 5. Existing and planned dependencies

| Dependency | Purpose | Notes |
| ---------- | ------- | ----- |
| Electron | desktop shell | rationale and cost in [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md); a development dependency of `apps/desktop/` from M2 (devDependencies, pinned 44.4.3), used for the development run and later packaging |
| mitmproxy | TLS / HTTP2 / MITM, infrastructure-level dependency | see [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md); section 2 of this policy requires an ADR for it. Since M1 it is a **runtime dependency**: the sidecar drives it through `mitmproxy.tools.main.mitmdump`, and it hosts the bridge and control plane (`bridges/python/swufe_bridge/sidecar.py`); its dedicated confdir also carries the MITM CA |
| cryptography | AES-128-CFB128 codec (WRD hostname token) | newly added as a direct dependency in M1; it was already pulled in transitively by mitmproxy, and declaring it directly pins the API the codec uses (`bridges/python/swufe_bridge/wrd_codec.py`) |
| pytest | Python-side test framework (L0/L1/L2) | newly added in M1, dev dependency group (`[dependency-groups] dev`) |
| hatchling | Python package build backend | newly added in M1, build-time dependency, not present at runtime |
| pycryptodome | used only by the archived prototype [wrd_codec.py](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/wrd_codec.py) | not a dependency of the current implementation; the M1 codec uses `cryptography`'s AES-CFB128 (equivalent to the prototype's `segment_size=128`, guaranteed by the TC-A02 gate vector) |
| sing-box | later TUN stage | not introduced in phase 1 |
| esbuild | Bundle the sandboxed preload (`apps/desktop/src/preload/index.ts` → `apps/desktop/dist/preload/index.js`) | Added in M2 (`apps/desktop/` devDependency, pinned 0.28.2). A `sandbox: true` preload cannot `require` relative paths, so a single file is mandatory; esbuild was already a transitive dependency of tsx and is declared directly to pin the bundling behaviour |
| tsx | Run `apps/desktop/test/**/*.test.ts` (TypeScript loader for Node's built-in test runner) | Added in M2 (`apps/desktop/` devDependency, pinned 4.23.15). Chosen because the repository-root documentation scripts already use the same approach (no second TS runtime) |
| typescript, `@types/node` | Only for this repository's documentation check scripts and for `apps/desktop/` type checking | Node side; `apps/desktop/` and the repository root use the same major versions (typescript 5.x, @types/node 22.x); no Markdown parser or framework is introduced |

### Dependency records (added in M2)

```text
Dependency:   electron
Version:      ^44.4.3 (pnpm-lock.yaml pins 44.4.3)
Purpose:      Desktop shell: login WebView, system-proxy orchestration host, CA install entry, IPC/preload boundary
Alternatives: Tauri (needs a Rust toolchain and behaves differently in WebView terms; ADR-0003 evaluated and chose Electron)
License:      MIT
Risk:         Large (macOS in the ~200MB range) and must ship with the package; the package ships no install script, so the platform binary is fetched once by hand with `node apps/desktop/node_modules/electron/install.js` (offline environments must pre-cache it)
```

```text
Dependency:   esbuild
Version:      ^0.28.2 (pnpm-lock.yaml pins 0.28.2)
Purpose:      Bundle the sandbox preload into a single file (relative require is unavailable in sandboxed preloads)
Alternatives: hand-written single-file preload (duplicates constants, poor maintainability); sandbox:false (weakens isolation, not accepted)
License:      MIT
Risk:         Platform-specific binary (shipped through optional dependencies); its install script is explicitly approved by `allowBuilds` in `pnpm-workspace.yaml`
```

```text
Dependency:   tsx
Version:      ^4.23.15 (pnpm-lock.yaml pins 4.23.15)
Purpose:      Run the TypeScript unit tests under apps/desktop/test with Node's built-in test runner (same approach as the root documentation scripts)
Alternatives: compile before testing (an extra build step, while the unit tests are deliberately electron-free); jest/vitest (would add a second test stack)
License:      MIT
Risk:         dev-only; brings its compilation capability through esbuild
```

```text
Dependency:   @types/node (22.x)
Version:      ^22.10.2 (pins 22.20.4)
Purpose:      Node types for Main/preload and the unit tests
Alternatives: none (standard practice)
License:      MIT
Risk:         types only, never shipped
```

```text
Dependency:   typescript
Version:      ^5.7.2 (apps/desktop resolves 5.9.3; the repository root is 5.x too)
Purpose:      Type checking and compilation for the three tsconfigs (Main/Renderer compiled, preload type-checked only)
Alternatives: none (consistent with the existing documentation scripts)
License:      Apache-2.0
Risk:         dev-only
```

### Dependency records (added in M1)

```text
Dependency:   cryptography
Version:      >=42 (bridges/python/uv.lock pins 48.0.1)
Purpose:      AES-128-CFB128 (token encryption/decryption) for the WRD codec
Alternatives: pycryptodome (used by the archived prototype; this policy forbids a second equivalent solution, and it would be an extra runtime dependency)
License:      Apache-2.0 / BSD-3-Clause (dual-licensed)
Risk:         no new platform binary (pulled in transitively by mitmproxy, already inside this project's dependency tree)
```

```text
Dependency:   pytest
Version:      >=8 (bridges/python/uv.lock pins 9.1.1)
Purpose:      test runner for L0/L1/L2
Alternatives: unittest (standard library; but parameterisation and fixture organisation cost more, and pytest is already the test stack inside mitmproxy's dependency tree)
License:      MIT
Risk:         dev dependency only, does not affect release artifacts
```

```text
Dependency:   hatchling
Version:      build backend (resolved by uv, see bridges/python/uv.lock)
Purpose:      building the swufe_bridge package (editable installs and future distribution)
Alternatives: setuptools / flit (hatchling is uv's default path with the least configuration)
License:      MIT
Risk:         build-time dependency only, not present at runtime
```
