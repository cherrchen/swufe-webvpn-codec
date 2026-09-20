# M2: Desktop Orchestration

> Status: Planned
> Owner: cherrchen
> Target: TBD (the original package defines no date)
>
> Chinese source of truth: [M2-desktop-orchestration.md](M2-desktop-orchestration.md)

## Goal

Wrap the bridge in the Electron app so the app performs the "log in → start bridge → campus resources usable" orchestration:

- Login WebView + Session Broker: no student ID/password stored, only the cookies the session needs plus minimal ancillary state (REQ-001, REQ-002);
- Proxy Orchestrator: read the OS proxy before starting, refuse to start and ask the user to close Clash / mihomo / sing-box etc. when it is already in use (REQ-004); point the system HTTP/HTTPS proxy at the local bridge when starting; clear it on stop, session expiry or exit only when the "set by this app" flag is present (NFR-004);
- Cert Manager: one-click install/uninstall of the local MITM CA, showing the risk notice on install (REQ-010, NFR-005);
- Session expiry handling: on detecting expiry, stop the bridge → clear the system proxy → stop process capture → prompt re-login.

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M1 |

## Exit criteria

- [ ] Electron can log in: the WebView completes CAS/MFA and obtains a usable WebVPN session, with no password file (TC-D01, P0)
- [ ] The bridge cannot be started while logged out (TC-D02, P0)
- [ ] An existing system proxy makes start fail with a clear notice (TC-C01, P0; see [ADR-0004](../../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md))
- [ ] Starting the bridge points the system HTTP/HTTPS proxy at the bridge port (TC-C02, P0)
- [ ] Stopping the bridge / exiting the app clears the proxy set by this app (TC-C03, TC-C04, P0; NFR-004)
- [ ] One-click CA install into the system trust store (TC-E01, P0) and one-click uninstall (TC-E02, P0); a clear failure notice when the CA is missing (TC-E03, P1)
- [ ] Session expiry triggers stop bridge + clear proxy + stop capture + re-login prompt (TC-D03, P0)
- [ ] Affected documents are synced (including bilingual pairs); no blocking defects

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R3 mitm embedding size / signing (medium/medium) | Larger package, signing and distribution friction | Keep mitm external in developer mode first; falling back to a separately installed mitm is acceptable |
| R4 macOS permission prompts scare users off (medium/medium) | Denied accessibility/network-extension permission blocks the process-capture path | UX guidance copy; keep only the system-proxy path if needed |
| R2 Cookie field changes (medium/high) | Session probing misjudges, causing false or missed expiry | Probing signals are centralized (probe-URL marker, session-clearing Set-Cookie, 302 to CAS) plus a manual re-login entry |

## Completion record

Not started yet; the completion time, evidence (commands and result summaries) and remaining issues are recorded here once it is done.
