# Bridge Control Protocol (Electron Main → mitm sidecar)

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [bridge-control-protocol.md](bridge-control-protocol.md)

## Scope

- Provider: the mitm sidecar (the local bridge process, including the thin WRD addon).
- Consumer: the Electron Main process (Proxy Orchestrator).
- Form: local inter-process interface. Phase 1 has adopted **option A** (child-process lifecycle + configuration file hot reload), see "Adopted implementation" below.
- Stability: Internal / Evolving — consumed only inside this app; option A is final, and no further control-plane shape is promised.
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md)

## Authentication and authorisation

- Option A adds no control listening port: the only listening surface is the bridge proxy port, always `127.0.0.1` (enforced by the sidecar in code, with no switch), and no token or account system is introduced.
- Cookies are sensitive: they must never be written to debug logs or to control-plane output (NFR-003).

## Common conventions

- Encoding: the control plane is a configuration file (JSON, UTF-8); diagnostics are single-line JSON on stderr.
- Time format: ISO8601 (`swufe-debug.ts`, `allowlist.updatedAt`).
- Pagination: none.
- Rate limiting: none (loopback / single-process calls).
- Idempotency: the configuration file is written as a full overwrite (idempotent, "last write wins"); terminating the process is equivalent to a graceful stop, and repeated calls converge.

## Adopted implementation: option A (child-process lifecycle + configuration file hot reload)

Phase 1 adopts option A (finalised 2026-09-21): Main only launches/terminates the sidecar process and writes the configuration the sidecar reads; no new listening port is added.

| Capability | Implementation |
| ---- | ---- |
| Start | `uv run python -m swufe_bridge.sidecar --config <file> --port <port> --confdir <dir>` (M2 spawns the same entry point as an Electron child process) |
| Readiness probe | a `swufe-ready` line on stderr **and** TCP reachable at `127.0.0.1:<port>` |
| Configuration delivery | write the configuration file (full overwrite); the sidecar hot-reloads it by polling mtime + size, with no signal and no restart |
| Configuration failure fallback | on a parse failure the last usable configuration is kept and the bridge keeps serving, emitting `swufe-error CONFIG_INVALID <message>` (the same message is not printed twice) |
| Stop | terminate the process (`SIGTERM`); a normal stop exits with code `0` |
| Startup failure | emit `swufe-error <CODE> <message>` and exit with code `2` (`CONFIG_INVALID`, `ALLOWLIST_EMPTY`) |

### Configuration file

- Path: defaults to `~/.swufe-webvpn-bridge/bridge-config.json`, overridden by `--config` (M2 passes a path under Electron `userData`).
- Permissions: `0600` (it contains the WebVPN session cookie, see NFR-003).
- Content (field names match `AllowlistConfig` / `SessionState` / `AppSettings` in [data-model.md](../architecture/data-model.md)):

  ```json
  {
    "allowlist": { "hosts": ["jwxt.swufe.edu.cn"], "includeSwufeWildcard": false, "updatedAt": "2026-09-21T00:00:00+00:00" },
    "cookies": [ { "name": "wrdvpn_session", "value": "<secret>", "domain": ".swufe.edu.cn", "path": "/" } ],
    "debug": false,
    "webvpnBase": "https://webvpn.swufe.edu.cn",
    "wrdKey": "wrdvpnisthebest!",
    "wrdIv": "wrdvpnisthebest!"
  }
  ```

| Key | Default | When invalid |
| ---- | ---- | ------ |
| `allowlist` | `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}` | raises `CONFIG_INVALID` |
| `cookies` | `[]`; each item requires `name` / `value`, `domain` / `path` are optional, unknown fields are ignored | raises `CONFIG_INVALID` |
| `debug` | `false` | raises `CONFIG_INVALID` |
| `webvpnBase` | `https://webvpn.swufe.edu.cn` | raises `CONFIG_INVALID` |
| `wrdKey` / `wrdIv` | `wrdvpnisthebest!` | length ≠ 16 bytes ⇒ raises `CONFIG_INVALID` |

- Missing keys take their default value; unknown top-level keys are ignored; a missing file or a JSON parse failure ⇒ `CONFIG_INVALID`.
- **The sidecar neither writes nor modifies this file**: the only writer is the app (M2); during M1 development it is written by hand.

### Diagnostics output (single-line stderr, machine-readable)

```text
swufe-debug {"ts":"2026-09-21T10:00:00+00:00","host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"request","detail":null}
swufe-ready {"listen_host":"127.0.0.1","listen_port":8080,"config":"/abs/path.json","allowlist":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false,"cookies":1,"debug":false}
swufe-error CONFIG_INVALID <message>
swufe-error ALLOWLIST_EMPTY allowlist 为空：请添加主机或启用 *.swufe.edu.cn
swufe-error LISTEN_NOT_LOOPBACK <message>
```

- `swufe-debug` keys are fixed to `ts` / `host` / `rewritten` / `direction` / `detail`; `detail` only takes short markers (`not-allowlisted`, `encode-failed`, `location`, `set-cookie`, `body`, `body-skipped`, `no-wrd-match`), and cookie values and request/response bodies **must never** appear (INV-001).
- `swufe-ready` is printed once from the addon's `running()` and reports the effective `listen_host` / `listen_port`; `cookies` reports the count only.
- Exit codes: normal stop `0`; startup validation failure (`CONFIG_INVALID`, `ALLOWLIST_EMPTY`) `2`.

### Development run

```bash
uv run python -m swufe_bridge.sidecar --config <bridge-config.json> --port 18080 --confdir <confdir>
# once ready (a swufe-ready line appears on stderr):
curl -sS -i -x http://127.0.0.1:18080 --cacert <confdir>/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/sso/jziotlogin
```

## Hard constraints

1. Cookies must never be written to debug logs or to control-plane output.
2. Listening is limited to `127.0.0.1` and must never listen on `0.0.0.0` or any externally reachable address. Enforcement: the sidecar hard-codes `--listen-host 127.0.0.1` and offers no switch to change the listening address; the addon re-checks the effective value in `running()`, and on a non-loopback address emits `swufe-error LISTEN_NOT_LOOPBACK` and stops.

## Versioning and compatibility

- Versioning: no standalone version number; stability is Internal.
- Breaking change process: update this file + [architecture/interfaces.md](../architecture/interfaces.md) + [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md) and state it in the PR's Breaking Changes section.
- Deprecation process: first mark it `Deprecated` here with its replacement, then remove it once Main has fully migrated.

## Change log

| Date | Change | Compatibility | Related spec / ADR |
| ---- | ---- | ------------- | ------------------ |
| 2026-09-20 | First version: options A / B recorded as candidates with hard constraints; implementation marked `TBD` | — | [spec 001](../../specs/001-phase1-local-bridge/spec.md) |
| 2026-09-21 | Option A finalised: configuration file path and field table, mtime + size polling hot reload with failure fallback, `swufe-ready` / `swufe-error` lines and exit codes, development run commands, loopback enforced by the sidecar in code | Compatible (the first version was not final and had no existing consumer) | [spec 001](../../specs/001-phase1-local-bridge/spec.md) / [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) |
