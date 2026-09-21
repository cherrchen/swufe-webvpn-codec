# ADR-0009: Adopt a path-based monorepo layout (`apps/<app>` + `bridges/<bridge>`)

> Chinese source of truth: [ADR-0009-monorepo-layout.md](ADR-0009-monorepo-layout.md)

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

Phase 1 shipped a **two-part** repository:

- the Electron app occupied `app/`;
- the Python bridge project sat directly at the repository root: root `pyproject.toml`, root `swufe_bridge/` package, root `tests/`, root `uv.lock` and root `.python-version`.

Neither of the two things already on the roadmap fits that layout:

- a **mobile application** is expected, and it needs a place next to the Electron app;
- the bridge may later be **re-implemented in another language** (for example Rust), which would need a second bridge project coexisting with the Python one.

Under the flat layout, both could only be accommodated by restructuring the repository. So the layout is settled now, while there are only two top-level entities and the reference surface is still small.

## Decision

The repository becomes a **path-based monorepo**: applications live in `apps/<app>`, bridge implementations in `bridges/<bridge>`. Applied now:

1. App: `app/` → `apps/desktop/`.
2. Bridge: the Python bridge project moves from the repository root → `bridges/python/`. Its `pyproject.toml`, `uv.lock`, `.python-version`, `swufe_bridge/` package and `tests/` move with it, and the virtualenv becomes `bridges/python/.venv`.
3. The repository root keeps **repository-level** tooling only: the Node documentation / spec / acceptance checks under `scripts/`, plus the root `package.json` aliases `dev` / `build` / `start` (which delegate to `apps/desktop`).

Scope and enforcement: this decision is in force from `2026-09-21`; accountable owner cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (keep the flat layout) | Zero migration cost | No top-level split between "applications" and "bridges"; both kinds of entity compete for the same place | A mobile app and a second bridge implementation could only be added by restructuring the repository first |
| Move only the package to `bridges/python/swufe_bridge/` and keep one project root at the repository root | Top-level directories become clearer with a small diff | One project root serving two languages | Ambiguous venv and lock ownership: it is unclear who owns the root `pyproject.toml` / `uv.lock` |
| Migrate to an npm / pnpm workspace package-manager layout | Unified workspace commands and dependency management | Requires changing the manifests and CI, and re-validating the start path under workspace semantics | Out of scope for this decision; the current manifests and CI keep npm |

## Consequences

### Positive

- The app resolves the repository root as **two levels above the app directory** and the bridge project as `<repo>/bridges/python` (a single `join` in the Main entry): it no longer relies on the assumption that the app sits at the repository root.
- Adding a future app or bridge implementation is **an added directory**, not a restructure: `apps/<app>` and `bridges/<bridge>` are each self-contained.
- The top level is the classification: `apps/` for applications, `bridges/` for bridge implementations, `scripts/` for repository-level checks.
- The sidecar's working directory becomes the bridge project root, the same subtree that holds the `swufe_bridge` package, the venv and the lock it actually needs.

### Negative

- The migration is a one-off path churn: the app's root resolution, the sidecar's working directory and the CI Python job (`working-directory: bridges/python`) all change together.
- Every document, script and command example that quotes an old path must follow, and anything missed points at a path that no longer exists.

### Unchanged on purpose

- The Electron package name is still `swufe-webvpn-bridge`, so the default `userData` directory is unchanged;
- the `swufe_bridge` module paths are unchanged;
- the sidecar argv and the stderr control protocol are unchanged;
- the `userData` file names are unchanged (`config.json` / `bridge-config.json` / `mitmproxy/`);
- `SWUFE_REPO_ROOT` still denotes the **repository root** and `SWUFE_PYTHON` is unchanged.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Old paths linger in documents / scripts, so commands fail where the files no longer are | Medium | Medium | The migration lands in one go: documents, READMEs, CI and command examples are updated in the same batch; this ADR records the old→new mapping |
| Somewhere implicitly assumes "sidecar working directory = repository root" | Low | Medium | The sidecar argv is unchanged and the working directory is explicitly the bridge project root; `SWUFE_REPO_ROOT` is still available to locate the repository root |
| A stale venv / lock left at the old root makes edits silently ineffective | Low | Medium | The repository root no longer keeps `pyproject.toml` / `uv.lock` / `.python-version` / `.venv`; interpreter resolution order is `SWUFE_PYTHON` → `bridges/python/.venv` → `uv run --project <repo>/bridges/python` |

## References

- Related spec: `specs/001-phase1-local-bridge/`
- Related ADRs: [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.en.md) (reuse mitmproxy, which made the Python side a project of its own), [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) (Electron for Phase 1 — today's `apps/desktop`)
- Related docs: [apps/desktop/README.md](../../../apps/desktop/README.md), [repository root README](../../../README.en.md)
