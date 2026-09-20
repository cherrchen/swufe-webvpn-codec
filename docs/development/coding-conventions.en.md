# Coding Conventions

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [coding-conventions.md](coding-conventions.md)

**Purpose**: align code organisation, naming and readability so that output from different authors (including coding agents) looks consistent.
**Do not write**: formatter configuration (that is repository config), architectural layering (→ [architecture/](../architecture/README.md)).

> This project's implementation languages come from the technical selection (see [architecture/overview.md](../architecture/overview.md));
> details that are not settled stay `TBD` — **do not** invent language-specific rules.

---

## 1. Language and versions

```text
Primary language:  Python 3 (bridge sidecar / authoritative WRD codec; the Electron app is TypeScript)
Language version:  Python >=3.12 (uv pins 3.13, see .python-version)
Package manager:   npm on the Node side (package-lock.json is committed); uv + uv.lock on the Python side (committed, run `uv sync`)
Formatter:         TBD (not introduced in this phase)
Linter:            TBD (not introduced in this phase)
```

## 2. Directory and module organisation

| Rule | Description |
| ---- | ----------- |
| Python package | `swufe_bridge/`: the sidecar package — `wrd_codec.py` (codec), `allowlist.py` (matching semantics and host-name validation), `config.py` (config surface + `ConfigWatcher`), `rewrite.py` (pure reverse-rewrite functions for responses), `addon.py` (mitmproxy addon), `sidecar.py` (process entry point). `__init__.py` holds only a docstring and performs no eager import, so L0 tests do not depend on mitmproxy |
| Test layers | `tests/l0` (no external dependencies: codec/allowlist/config), `tests/l1` (addon behaviour + fake flows), `tests/l2` (real sidecar + curl + fake upstream). Shared fixtures: `tests/conftest.py` (config factories, no mitmproxy import) and `tests/l1/conftest.py` (flow / addon factories) |
| Dependency direction | `addon → rewrite / config / allowlist / wrd_codec`; `config → allowlist`; `sidecar → addon + config`. No reverse dependencies (consistent with the dependency rules in [architecture/components.md](../architecture/components.md)) |

## 3. Naming

| Object | Convention |
| ------ | ---------- |
| Files | snake_case: modules `wrd_codec.py`, `allowlist.py`; tests `test_addon_request.py` |
| Types | PascalCase: `WrdCodec`, `AllowlistConfig`, `BridgeRuntimeConfig`, `BridgeAddon` |
| Functions | snake_case: `normalize_host`, `encode_url`, `rewrite_body_text`; module-internal helpers use a `_` prefix (`_build_re`, `_inject_cookies`) |
| Variables | snake_case; contract constants shared across surfaces are gathered in UPPER_SNAKE at the top of the module (`DEFAULT_HOSTS`, `REWRITABLE_CONTENT_TYPES`, `METADATA_ORIGINAL_URL`) |
| Constants | UPPER_SNAKE_CASE |
| Config / interface fields | JSON fields use camelCase (`includeSwufeWildcard`, `webvpnBase`, `wrdKey`), consistent with the `docs/` contracts; Python-internal attributes use snake_case (`include_swufe_wildcard`, `webvpn_base`) |

The table above records the conventions actually in place after M1 landed. Cross-module constraints (independent of the implementation):

- IPC / interface type and field naming has a single source of truth: [api/electron-ipc.md](../api/electron-ipc.md);
- Error codes must use the six established ones — `PROXY_CONFLICT`, `CA_MISSING`, `NOT_LOGGED_IN`, `SESSION_EXPIRED`, `BRIDGE_CRASH`, `ALLOWLIST_EMPTY` — and no synonymous codes may be invented.

## 4. Style essentials

- Follow existing repository patterns; two equivalent conventions side by side are **not allowed** (see the precedence rules in [README.md](README.md)).
- Avoid unreadable abbreviations; avoid abstractions used once.
- Comments explain *why*, never restate *what*.
- Public APIs must carry doc comments (docstrings in English; public interface contracts live in [docs/api/](../api/README.md), and code comments must point at the matching interface surface).
- User-facing text (error messages, CLI help) is written in Chinese: e.g. `swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn`; machine-readable parts (stderr line prefixes, error codes, JSON keys) stay English/fixed literals.
- Data contracts are expressed in code through types and validation: config and allowlist parsing is centralised in `swufe_bridge/config.py` / `swufe_bridge/allowlist.py`, and other modules only consume already-validated objects.

## 5. Error handling

| Scenario | Requirement |
| -------- | ----------- |
| Input validation | allowlist host names must be valid hostnames and lower-cased (see the matching algorithm in [architecture/data-model.md](../architecture/data-model.md)): implemented as `swufe_bridge.allowlist.normalize_host` (illegal input raises `InvalidHostError`, a subclass of `ConfigError`) |
| Config error | the runtime config is validated by `swufe_bridge.config`, and anything illegal raises `ConfigError`: at startup this becomes `swufe-error CONFIG_INVALID <message>` + exit code `2`; a failed hot reload at run time keeps the last usable config and reports it only once |
| Recoverable error | return an error code to the UI; do not stop the bridge process (a failed rewrite inside the addon must always pass through unmodified and record a short `swufe-debug` marker) |
| Unrecoverable error | `BRIDGE_CRASH`: log it and let the user restart the bridge |
| Never swallow errors | silent `catch`/ignored return codes are forbidden unless a comment states the reason (e.g. "keep the original `Referer` instead of aborting the request" in the addon must state why) |

## 6. Dependencies and imports

- Dependency direction must match [architecture/components.md](../architecture/components.md);
- No circular dependencies;
- Read [dependency-policy.md](dependency-policy.md) before adding a dependency;
- A second equivalent solution is forbidden (see [dependency-policy.md](dependency-policy.md)).

## 7. Change discipline

- No refactors unrelated to the task;
- Do not delete code of unknown purpose;
- Changing public behaviour requires syncing tests and documentation;
- "While I'm here" improvements are scope creep and need their own task.

## 8. Local check commands

```text
Format:  TBD (no formatter introduced in this phase)
Lint:    TBD (no linter introduced in this phase)
Type:    TBD (no type checker on the Python side; `npm run typecheck` on the Node side)
Test:    uv run pytest (run `uv sync` first)
Docs:    npm run docs:check
```

> CI has two workflows: the documentation check [.github/workflows/docs-check.yml](../../.github/workflows/docs-check.yml) and Python L0 [.github/workflows/python-tests.yml](../../.github/workflows/python-tests.yml).
