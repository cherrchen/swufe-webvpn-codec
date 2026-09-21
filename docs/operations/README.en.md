# Operations Documentation

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [README.md](README.md)

**Purpose**: record long-lived facts about runtime environments, configuration, deployment, observability, backup and incident response.
**Scope**: SWUFE WebVPN Bridge Phase 1 — **this application is a single-machine desktop tool** (an Electron app plus a local mitmproxy sidecar) for macOS and Windows, with no server side.

---

## 1. Environments

| Environment | Purpose | Notes | Access |
| ----------- | ------- | ----- | ------ |
| Development (local) | Development and local debugging | Local Node (Electron app) + Python venv (WRD codec and addon) + `mitmdump` | Developer machine |
| Acceptance (local, real hardware) | L3 manual acceptance | One macOS and one Windows test machine running a real WebVPN session; Chrome/Edge used for the registrar browser acceptance (requires the tester's own account) | Tester machine |
| Production / server | Not applicable | A single-machine desktop tool: no server-side component is deployed and no central runtime exists | — |

> Phase 1 has no test/staging cluster: the upstream is the university's real WebVPN, so local testing is already the final runtime shape.

## 2. Configuration

| Key | Purpose | Allowed values | Default | Sensitive | Change impact |
| --- | ------- | -------------- | ------- | --------- | ------------- |
| `bridgePort` | Port the local bridge listens on as an HTTP/HTTPS proxy | An available port (8080 or auto-assigned) | 8080 or auto | Low | The system proxy points at this port; changing it while the bridge runs requires a restart |
| `debugLogging` | Debug logging switch | `true` / `false` | `false` | Low | When on, records "host + rewritten yes/no + direction + time", still never bodies or cookies |
| `captureMode` | Capture mode: the system proxy takes all traffic, or only the selected apps are captured (M3; the two exclude each other) | `system-proxy` / `selected-apps` | `system-proxy` | Low | Switching to `selected-apps` revokes the system proxy this app set; switching back sets it again and removes process capture; switching to `selected-apps` is refused while another tool owns the system proxy |
| `captureProcesses` | Application patterns for process capture (mitmproxy local), M3 | A deduplicated array of non-empty, comma-free strings (at most 32; an `.app` bundle path or a full executable path) | `[]` | Low | Pushed to `capture.processes` in `<userData>/bridge-config.json` only while `captureMode = selected-apps`; changing it at runtime needs no bridge restart and a failure is not retried automatically (the UI's retry re-pushes it); the first enable on macOS asks for the system-extension authorisation |
| `webvpnBase` | Upstream WebVPN base URL (rewrite target) | URL | `https://webvpn.swufe.edu.cn` | Low | Changing it invalidates the registrar acceptance result; re-acceptance is required |
| `wrdKey` / `wrdIv` | Key / iv for WRD hostname encryption | String (defaults used in phase 1) | `wrdvpnisthebest!` | High | A wrong value breaks encoding; must match the upstream scheme (ADR-0005) |
| `systemProxyManagedByApp` | "System proxy was set by this app" marker (runtime) | `true` / `false` | `false` | Low | Determines whether stopping the bridge / quitting clears the system proxy; a wrong marker leaves a stale proxy or clears someone else's |
| `allowlist.hosts` | Hosts rewritten through WebVPN | Array of lowercase valid hostnames (exact match) | `["jwxt.swufe.edu.cn"]` | Low | Adding a host widens the scope of decryption and rewriting |
| `allowlist.includeSwufeWildcard` | `*.swufe.edu.cn` wildcard (including the apex `swufe.edu.cn`) | `true` / `false` | `false` | Low | When on, `swufe.edu.cn` and all its subdomains are rewritten |
| `allowlist.updatedAt` | Last update time of the allowlist | ISO8601 string | Creation time | Low | Record keeping only |

- **Storage**:
  - `<userData>/config.json`: the top level carries the allowlist (`hosts` / `includeSwufeWildcard` / `updatedAt`) and a sibling `settings` key holds `AppSettings` (missing keys take their default); the Python side reads the allowlist part of the same file.
  - `<userData>/bridge-config.json`: the runtime config handed to the sidecar (`allowlist` + `cookies` + `debug` + `webvpnBase` + `wrdKey`/`wrdIv` + `capture.processes`), mode `0600` (it carries session cookies); the app is the only writer. The sidecar starts mitmdump as `--mode regular@<bridgePort>` (never `--listen-port`, see ADR-0006), and capture changes reach it through this file's mtime+size hot reload.
  - `<userData>/mitmproxy/`: the MITM CA confdir (private key `0600`), which is also the sidecar's `--confdir`.
  - `<userData>/Partitions/swufe-login/`: the login session (Electron persistent partition; no `session.bin` is written); cookie location and encryption are in section 4 of [security/README.md](../security/README.md).
- **Configuration sources and precedence**: the persistent file is the single source; build-time defaults only fill missing keys or the first start; `settings.bridgePort` and `settings.webvpnBase` are read and pushed when the bridge starts, and the runtime marker `systemProxyManagedByApp` is written by the Proxy Orchestrator. How configuration reaches the sidecar is described in [bridge-control-protocol.md](../api/bridge-control-protocol.md).
- **Development overrides**: `--user-data-dir <dir>` (or `SWUFE_USER_DATA_DIR`) overrides `userData`; `SWUFE_REPO_ROOT` overrides the repository root; `SWUFE_PYTHON` picks the interpreter that runs the sidecar/CA entry points; `SWUFE_PROBE_INTERVAL_MS` overrides the session-expiry probe interval.
- **Secret handling**: see [security/README.md](../security/README.md).

## 3. Deployment

```text
Artifact:      Electron installer (macOS / Windows) + mitmproxy sidecar
               (the WRD codec and bridge addon ship with the sidecar)
Method:        The user installs and runs it locally; the app launches the
               mitmproxy sidecar as a child process on startup
               Development equivalent: local Node + Python venv + mitmdump
               (from M2: run `uv sync` in the repository root, then
               `npm --prefix app install && npm --prefix app start`; the app spawns the sidecar via
               `<repo>/.venv/bin/python -m swufe_bridge.sidecar`, see [app/README.md](../../app/README.md);
               the full procedure - prerequisites / start / administrator operations / self-check /
               troubleshooting / reset - is in [development-run.md](development-run.md))
Distribution:  TBD - embedded Python runtime versus an external mitmproxy
               executable is not yet chosen (size/signing trade-off, see
               ADR-0002, decided during implementation)
Release flow:  TBD - there is no release pipeline yet; the current CI runs
               documentation checks (npm run docs:check) and the Python L0
               tests (.github/workflows/python-tests.yml); packaging and
               distribution belong to M4
Rollback:      Stop the bridge -> confirm the system proxy is restored ->
               uninstall the local MITM CA; if needed, roll back to the
               previous installer
```

> Every deployment and rollback step depends on the constraints in section 8 of [security/README.md](../security/README.md), "Security-sensitive operations": the system proxy is cleared only when the marker exists, and the CA is installed or removed only by an explicit user action.

## 4. Observability

| Dimension | Tooling | Key signals | Retention |
| --------- | ------- | ----------- | --------- |
| Logs | In-app debug log (off by default) | Host + rewritten yes/no + direction (request/response) + time; no bodies or cookies (`DebugLogRecord`) | In-memory ring buffer; on-disk storage and retention are `TBD` (not defined for phase 1) |
| Metrics | Not applicable | No server-side metric collection (single-machine desktop tool) | Not applicable |
| Tracing | Not applicable | No distributed tracing | Not applicable |
| Alerts | Not applicable | No server-side alerting; the status area and error codes (`PROXY_CONFLICT`, `CA_MISSING`, `NOT_LOGGED_IN`, `SESSION_EXPIRED`, `BRIDGE_CRASH`, `ALLOWLIST_EMPTY`) are the user-visible signals | Not applicable |

## 5. Backup and recovery

```text
Scope:           userData/config.json (settings + allowlist)
                 userData/Partitions/swufe-login/ (login session partition; cookie plaintext
                 is protected by the OS user-directory permissions)
                 MITM CA confdir (the mitmproxy-dedicated directory)
Frequency:       TBD - phase 1 defines no automatic backup (settings can be
                 re-entered and the CA can be regenerated)
Retention:       TBD - as above
Restore drills:  TBD - as above
RPO / RTO:       TBD - as above
```

Consequences of losing each object: losing `config.json` means rebuilding the allowlist and settings; losing the login partition means logging in again; losing the CA confdir means regenerating the CA and reinstalling it in the system trust store.

## 6. Incident response

| Incident | Response | Owner |
| -------- | -------- | ----- |
| Bridge crash (`BRIDGE_CRASH`) | Check the debug log for the sidecar exit cause and restart the bridge; reopen the app if needed | cherrchen |
| Session expired (`SESSION_EXPIRED`) | The product flow stops the bridge, clears the system proxy and stops capture automatically; then log in again in the login window | cherrchen |
| Stale system proxy | After quitting the app, confirm the system proxy is restored; if it still points at `127.0.0.1:<bridgePort>`, clear it manually (the app clears it only when the "set by this app" marker exists) | cherrchen |
| CA installed by mistake / no longer wanted | Stop the bridge first, uninstall the local MITM CA, and confirm it is gone from the system trust store | cherrchen |

## 7. Related

- Configuration field definitions ⇒ [architecture/data-model.md](../architecture/data-model.md) (`AppSettings` / `AllowlistConfig`)
- Security constraints on configuration and cookies ⇒ [security/README.md](../security/README.md)
- Interface that delivers configuration to the sidecar ⇒ [api/bridge-control-protocol.md](../api/bridge-control-protocol.md)
- Documentation impact of configuration changes ⇒ the documentation update matrix in [documentation-rules.md](../development/documentation-rules.md)
- Verification and the release gate ⇒ section 6 of [verification-strategy.md](../verification/verification-strategy.md), [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)
