# Operations Documentation

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
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
| `capturePids` | PID list for process capture (mitmproxy local) | Array of local process PIDs | `[]` | Low | Changing the set requires restarting capture; macOS may prompt for authorisation |
| `webvpnBase` | Upstream WebVPN base URL (rewrite target) | URL | `https://webvpn.swufe.edu.cn` | Low | Changing it invalidates the registrar acceptance result; re-acceptance is required |
| `wrdKey` / `wrdIv` | Key / iv for WRD hostname encryption | String (defaults used in phase 1) | `wrdvpnisthebest!` | High | A wrong value breaks encoding; must match the upstream scheme (ADR-0005) |
| `systemProxyManagedByApp` | "System proxy was set by this app" marker (runtime) | `true` / `false` | `false` | Low | Determines whether stopping the bridge / quitting clears the system proxy; a wrong marker leaves a stale proxy or clears someone else's |
| `allowlist.hosts` | Hosts rewritten through WebVPN | Array of lowercase valid hostnames (exact match) | `["jwxt.swufe.edu.cn"]` | Low | Adding a host widens the scope of decryption and rewriting |
| `allowlist.includeSwufeWildcard` | `*.swufe.edu.cn` wildcard (including the apex `swufe.edu.cn`) | `true` / `false` | `false` | Low | When on, `swufe.edu.cn` and all its subdomains are rewritten |
| `allowlist.updatedAt` | Last update time of the allowlist | ISO8601 string | Creation time | Low | Record keeping only |

- **Storage**: `userData/config.json` (settings + allowlist); session cookie storage and encryption are in section 4 of [security/README.md](../security/README.md).
- **Configuration sources and precedence**: `TBD` — phase 1 has a single persistent source, `userData/config.json`; precedence between build-time defaults and runtime fields (such as `systemProxyManagedByApp`) is undefined and must be settled during implementation. How configuration reaches the sidecar is described in [bridge-control-protocol.md](../api/bridge-control-protocol.md).
- **Secret handling**: see [security/README.md](../security/README.md).

## 3. Deployment

```text
Artifact:      Electron installer (macOS / Windows) + mitmproxy sidecar
               (the WRD codec and bridge addon ship with the sidecar)
Method:        The user installs and runs it locally; the app launches the
               mitmproxy sidecar as a child process on startup
               Development equivalent: local Node + Python venv + mitmdump
Distribution:  TBD - embedded Python runtime versus an external mitmproxy
               executable is not yet chosen (size/signing trade-off, see
               ADR-0002, decided during implementation)
Release flow:  TBD - implementation has not started and no release pipeline
               exists; the current CI only runs documentation checks
               (npm run docs:check)
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
                 userData/session.bin (session cookies, optionally safeStorage-encrypted)
                 MITM CA confdir (the mitmproxy-dedicated directory)
Frequency:       TBD - phase 1 defines no automatic backup (settings can be
                 re-entered and the CA can be regenerated)
Retention:       TBD - as above
Restore drills:  TBD - as above
RPO / RTO:       TBD - as above
```

Consequences of losing each object: losing `config.json` means rebuilding the allowlist and settings; losing `session.bin` means logging in again; losing the CA confdir means regenerating the CA and reinstalling it in the system trust store.

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
