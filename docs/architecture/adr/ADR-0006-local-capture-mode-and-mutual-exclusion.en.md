# ADR-0006: Process capture via mitmproxy local mode, mutually exclusive with the system proxy

## Status

`Accepted`

## Date

`2026-09-21`

## Decision Owners

`cherrchen`

## Context

REQ-003 requires two traffic-takeover modes in Phase 1: the system HTTP/HTTPS proxy pointing at the local bridge port, and **per-process capture** (picking a browser or another application). M2 landed the system-proxy path ([ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md)); M3 has to implement the second mode.

There are two implementation options: build a network extension (System Extension / WFP driver) that redirects the chosen processes to the local bridge, or reuse mitmproxy's built-in `local` mode (`--mode local:<spec>`). The latter is implemented in `mitmproxy_rs` for both platforms: on macOS it unpacks `Mitmproxy Redirector.app` into `/Applications` and activates a system extension, on Windows it uses WFP with a UAC prompt; an intercept spec entry is "a number means PID, otherwise `process_name.contains(name)`" (on macOS the path comes from `proc_pidpath` and is matched with `contains`).

One conflict must be handled: the bridge's regular listener is an HTTP proxy, whereas connections produced by `local` mode enter the **transparent** layer. If a captured application still points its system proxy at the bridge port, its `CONNECT` reaches the transparent layer, where the proxy core rejects it as a protocol error (mitmproxy explicitly refuses a CONNECT on a transparent stream). So "system proxy" and "selected apps" cannot be active for the same application at the same time.

## Decision

1. **Process capture is implemented with mitmproxy's `local` mode**, without adding a self-built network extension or driver:
   - capture = appending a `local:<spec>` mode to the same mitmproxy instance;
   - the spec is a **path substring**: applications use their `.app` bundle path (e.g. `/Applications/Google Chrome.app/`), anything else uses the executable's full path. The bundle path covers both the main process and its helper subprocesses, and — unlike a short name such as `Safari` — cannot hit an unrelated process.
2. **The two capture modes are mutually exclusive**, controlled by an explicit `captureMode` (`system-proxy` / `selected-apps`):
   - `selected-apps`: the app sets no system proxy; one it set earlier is revoked (clearing the `systemProxyManagedByApp` flag); the runtime config carries `capture.processes`.
   - `system-proxy`: local capture stays off; `capture.processes` in the runtime config is always empty.
   - `bridgePort` stays usable in both modes: the regular listener is never removed and `local` mode occupies no additional port (`listen_addrs` is empty for `local`).
3. **When another tool owns the system proxy, selecting apps is refused as well** (`PROXY_CONFLICT`, the same principle as ADR-0004): otherwise a captured app's connections would be taken over by that other proxy and fail silently.
4. **The sidecar starts with `--mode regular@<port>` and never `--listen-port`**: a global `listen_port` applies to every mode, so a `local:` mode added at runtime would collide with `regular` in mitmproxy's duplicate-listen-address check and raise `OptionsError`. The `listen_port` in `swufe-ready` is derived from the regular mode.
5. **Capture is an optional capability that takes effect asynchronously**: the addon polls the runtime config once per second and adds/removes `local:<spec>` on first apply and on every change, reporting the outcome as `swufe-capture {"enabled","processes","error"}`. A failure is **not retried automatically** until the config is rewritten (the UI's retry button re-pushes it). A capture failure never changes the bridge state (the bridge keeps `running`); it only shows up in `BridgeStatus.captureError`.
6. **Accountable owner**: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not chosen |
| ----------- | ---- | ---- | -------------- |
| Build a network extension / driver for per-process redirection | Fully under our control; no dependency on mitmproxy's Rust side; no `/Applications` unpacking | Requires kernel-extension/system-extension code on both platforms, plus long-term signing and distribution; contradicts the "reuse a mature stack" direction (ADR-0002) | Cost and risk far outweigh the benefit, and M1/M2 already fixed the rewriting logic inside a mitmproxy addon |
| Ship the system proxy only, no per-process capture | Smallest implementation, no extra authorisation prompts | Does not meet REQ-003 (the user cannot narrow the scope to picked apps), and the user's own proxy tool cannot be kept | Directly conflicts with this milestone's exit criteria |
| Enable both modes at once (capture + system proxy) | Looks more complete | A captured app's `CONNECT` enters the transparent layer and fails hard; the symptom is a silently half-broken setup ("some requests 502") | Unpredictable behaviour, against ADR-0004's "refuse rather than half-work" principle |
| Treat a capture failure as a bridge error state | More conspicuous status | Process capture is optional; failing it must not take the system-proxy main path down with it (REQ-003 boundary / R4) | Show `captureError` in place with a retry; the bridge keeps running |
| Use a process short name (e.g. `Safari`) as the intercept pattern | Shorter, more readable spec | Can hit an unrelated same-named process; cannot cover helper subprocesses (Chrome's helpers have different paths) | Use the bundle path / full executable path |

## Consequences

### Positive

- Reuses existing mitmproxy capabilities; no new self-built network component or distribution burden (consistent with ADR-0002);
- The traffic path is unique and attributable: only one takeover mode is active at a time, so troubleshooting never has to ask "which layer did this";
- A capture failure does not affect the main path: system-proxy mode keeps working in every case (REQ-003 boundary / R4);
- Switching capture modes does not restart the sidecar, and `bridgePort` is available throughout.

### Negative

- Depends on `mitmproxy_rs` platform behaviour: on macOS the first enable unpacks `Mitmproxy Redirector.app` into `/Applications` and requests a system-extension authorisation; on Windows it requires UAC elevation. An external dependency that needs regression on upgrades;
- If the user manually points a captured application's proxy at the bridge port, that application's `CONNECT` fails hard (the other side of the exclusion);
- The candidate list comes from OS process enumeration (macOS `ps -Ao pid=,comm=`, Windows `tasklist`), so only running applications can be listed; apps that are saved but not currently running must still be visible in the UI;
- Process capture cannot cover processes running as root (matching and permission boundaries of the system extension/driver).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The macOS system-extension prompt scares users off (R4) | Medium | Medium | No automatic retry after a failure; the UI explains "System Settings → General → Login Items & Extensions" and offers a retry button; a failure on this path does not affect the system-proxy main path |
| The first enable is not confirmed within 5 seconds and fails | Medium | Low | This is an expected failure path: show the reason, the guidance and a retry; never trigger the authorisation repeatedly in the background |
| Option re-evaluation when `local` and `regular` share one mitmproxy instance (`OptionsError`) | Low | Medium | Do not pass `--listen-port` at startup; derive `listen_port` from the mode; on failure roll the mode set back and report the error |
| Platform differences (Windows UAC / permission model) | Medium | Medium | Real-hardware Windows verification is deferred to M4 (T038); the implementation reuses the same spec and state machine |

## References

- Related requirements: REQ-003, REQ-004, REQ-009, NFR-004, NFR-005
- Related spec: [specs/001-phase1-local-bridge/](../../../specs/001-phase1-local-bridge/spec.md), [tasks.md T026/T031](../../../specs/001-phase1-local-bridge/tasks.md)
- Related ADRs: [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.en.md) (reuse the mitmproxy stack), [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md) (refuse rather than half-work on conflict)
- Related docs: [bridge control protocol](../../api/bridge-control-protocol.en.md) (the `capture` config key and the `swufe-capture` diagnostic line), [Electron IPC](../../api/electron-ipc.en.md) (`setCaptureMode` / `setCaptureProcesses`), [main window](../../ui-ux/main-window.en.md) (capture-mode section and authorisation copy)
- Implementation evidence: `mitmproxy/proxy/mode_specs.py` (`LocalMode.default_port = None`), `mitmproxy/proxy/mode_servers.py` (`LocalRedirectorInstance`), `mitmproxy/addons/proxyserver.py` (duplicate-listen-address check), and `mitmproxy_rs`'s intercept-spec matching semantics
