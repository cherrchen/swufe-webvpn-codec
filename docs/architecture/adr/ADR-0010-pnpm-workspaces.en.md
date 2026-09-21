# ADR-0010: Switch the Node toolchain to pnpm 11 workspaces

> Chinese source of truth: [ADR-0010-pnpm-workspaces.md](ADR-0010-pnpm-workspaces.md)

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

The repository has already become a **path-based monorepo** per [ADR-0009](ADR-0009-monorepo-layout.en.md): the app lives in `apps/desktop` and the Python bridge in `bridges/python`. The Node side, however, was still run by **npm**, and a single dependency graph was split in two: the root `package-lock.json` and `apps/desktop/package-lock.json`. ADR-0009 had listed "migrate to a workspace package-manager layout" as **not adopted** (the reason then: out of scope for that decision), so the package-manager question was deferred rather than settled.

Two lockfiles plus per-directory installs cannot model a workspace:

- the app directory's dependencies are a separate resolution; the root resolution does not contain them;
- the two lockfiles can drift apart, and installing has to happen twice — once at the root, once in the app directory;
- the root `package.json` only had the three delegating aliases `dev` / `build` / `start`, with no way to select a script by **package name**.

Constraints: the layout and the start-up path (ADR-0009) are unchanged; the Python side still belongs to uv; the Node version requirement is unchanged (`>=22`).

## Decision

1. The Node side moves to **pnpm 11 workspaces**:
   - the root [pnpm-workspace.yaml](../../../pnpm-workspace.yaml) declares membership with `packages: [apps/*]` — **membership is defined by that file**, not by a `workspaces` field in `package.json`;
   - the `allowBuilds` list in the same file **reviews and allows** exactly two dependencies' build scripts: `electron: true`, `esbuild: true`;
   - the root [package.json](../../../package.json) pins `"packageManager": "pnpm@11.25.0"`.
2. **One lockfile**: both npm lockfiles (the root one and `apps/desktop/package-lock.json`) are deleted, leaving only the root `pnpm-lock.yaml`, which covers both workspace projects (the `.` and `apps/desktop` importers).
3. **CI install**: `pnpm/action-setup@v4` (version taken from `packageManager`) → `actions/setup-node` (`cache: pnpm`) → `pnpm install --frozen-lockfile`.
4. **Script entry points**: the root `dev` / `build` / `start` convenience scripts delegate to the app with `pnpm --filter swufe-webvpn-bridge run <script>`; the app's own scripts call pnpm too, and its non-standard `allowScripts` field is gone, with `allowBuilds` carrying that intent.
5. Scope and enforcement: this decision is in force from `2026-09-21`; accountable owner cherrchen. The Python side is out of scope.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (keep npm and the two lockfiles) | Zero change | No workspace resolution, installing twice, two lockfiles that can drift | The layout was already settled by ADR-0009 while dependency resolution stayed split in two — exactly the state this round removes |
| Keep npm and only add a `workspaces` field to the root `package.json` | No package-manager switch, small migration | npm workspaces would still need their own "allow dependency build scripts" mechanism, and would not unify what the repository root already configured | pnpm ships `allowBuilds` (dependency build-script review) built in; doing it again on npm workspaces is equivalent work for no gain |
| Add a task runner on top of the workspace (Turbo / Nx, …) | A multi-package task graph and caching | A new configuration surface and new dependencies | There are only two delegating scripts today, and `pnpm --filter` already covers them |

## Consequences

### Positive

- One `pnpm install` installs every project in the workspace, and dependencies resolve once.
- Scripts are selected by **package name** (`pnpm --filter swufe-webvpn-bridge run build`) instead of by "which directory am I in".
- The repository has a single `pnpm-lock.yaml`, and `--frozen-lockfile` in CI is enough to keep the lockfile and the manifests consistent.

### Negative

- A dependency's build scripts do **not** run by default: only dependencies listed in `allowBuilds` do; one that is not listed makes `pnpm install` fail with `ERR_PNPM_IGNORED_BUILDS` — such a dependency must be reviewed and added to the list first.
- Passing Electron flags must **not** use a `--` separator: when a `--` appears in the command, pnpm inserts its own on top, so Electron receives a literal `--` and stops parsing Chromium switches (`--remote-debugging-port` silently does nothing). The correct form is `pnpm start --user-data-dir=<dir>`.
- electron 44.x still needs the one-off `node apps/desktop/node_modules/electron/install.js`: `pnpm install` does not download the Electron binary.

### Unchanged on purpose

- The Electron package name is still `swufe-webvpn-bridge`, so the default `userData` directory is unchanged;
- the `swufe_bridge` module paths are unchanged, and so are the sidecar argv and the stderr control protocol;
- the Python side keeps uv: `bridges/python/uv.lock`, `uv sync --directory bridges/python`.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| A new dependency ships build scripts without being listed in `allowBuilds`, so installing fails | Medium | Medium | The failure names `ERR_PNPM_IGNORED_BUILDS`; review it following the comment in `pnpm-workspace.yaml` and add it to the list |
| Documents / command examples still use npm forms, or add a `--` separator to Electron flags | Medium | Medium | Documents and examples are updated in the same batch; the correct form is recorded in the `pnpm-workspace.yaml` comment and in this ADR |
| A stray `--` separator is added for Electron, silently disabling Chromium switches | Low | Medium | Verify with `pnpm start --user-data-dir=<dir> --remote-debugging-port=<port>` (measured: it does not work with the `--`) |
| A leftover npm lockfile makes edits silently ineffective | Low | Medium | Both `package-lock.json` files are deleted and `pnpm-lock.yaml` is the only lockfile; `--frozen-lockfile` in CI surfaces lockfile drift as a failure |
| Somewhere still assumes the Electron binary is at the root `node_modules/electron` | Low | Medium | The path is explicitly `apps/desktop/node_modules/electron/install.js` (unchanged under pnpm) |

## References

- Related spec: `specs/001-phase1-local-bridge/`
- Related ADRs: [ADR-0009](ADR-0009-monorepo-layout.en.md). This ADR supersedes the conclusion of the "keep npm / the current manifests and CI keep npm" row in ADR-0009's alternatives table; **ADR-0009's layout decision itself stands**, and this ADR only closes out the package-manager question it deliberately deferred. [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) (Electron for Phase 1) is unaffected.
- Related files: [pnpm-workspace.yaml](../../../pnpm-workspace.yaml), [root package.json](../../../package.json), [.github/workflows/app-tests.yml](../../../.github/workflows/app-tests.yml), [apps/desktop/README.md](../../../apps/desktop/README.md)
- External material: <https://pnpm.io/workspaces>
