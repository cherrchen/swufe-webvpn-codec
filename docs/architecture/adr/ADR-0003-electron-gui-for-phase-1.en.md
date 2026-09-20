# ADR-0003: Use Electron for Phase 1 instead of a CLI-only tool

> Chinese source of truth: [ADR-0003-electron-gui-for-phase-1.md](ADR-0003-electron-gui-for-phase-1.md)

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

Login for the local bridge is not an API call but the official WebVPN CAS / MFA web flow: the user must complete login in a WebView that can render the login page and handle redirects and multi-factor steps before the bridge can obtain a usable session cookie (REQ-002). CA installation and removal are equally graphical: they must call the OS trust store, show the "this machine's HTTPS will be decrypted" risk notice before installing, and support one-click revocation (REQ-010, NFR-005, G-003). There is also a permanently visible control surface: connection toggle, allowlist editing, status and error reasons, process-capture selection and a debug-logging switch (REQ-001, REQ-005, REQ-009).

Constraints: G-002 requires no more than 3 clicks from "logged in" to "browser opens the academic-affairs site"; NFR-007 requires Chinese-first UI and copy; REQ-011 / NFR-006 require macOS and Windows in Phase 1. The delivery form must therefore be fixed now, as it dictates how the UI, packaging and OS-adaptation layers are organised.

## Decision

Ship Phase 1 as an Electron desktop application, as the **only** delivery form; do not provide a CLI-only path as a usable Phase 1 option.

- Login, CA guidance, bridge start/stop, allowlist management and status display are all carried by the GUI (REQ-001);
- Never make "run a command line yourself" a precondition of any acceptance flow (G-002 depends on ≤3 clicks inside the GUI);
- UI and copy are Chinese-first (NFR-007), covering both macOS and Windows (REQ-011);
- In force from Phase 1; switching desktop shells (e.g. to Tauri / Qt) requires a new ADR superseding this one;
- Owner: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (neither GUI nor CLI) | No UI development cost | No entry point for login, CA guidance or status; REQ-001 and G-001 both fail | Requirement unmet |
| CLI only (commands plus config files) | Least development; easy to script and debug | Poor CAS / MFA login and certificate-guidance experience; users must manipulate the OS trust store themselves; status and errors stay invisible and G-002 is unreachable | Poor login and certificate guidance; fails the acceptance path |
| Tauri | Small package, low memory | Login WebView behaviour and cross-platform maturity need extra evaluation; Python-sidecar integration is equally bespoke | Given WebView login and macOS/Windows maturity, Electron was chosen for Phase 1 |
| Qt | Mature native UI capability; good performance | Unrelated to the existing frontend stack; a second development and packaging toolchain, expensive in Phase 1 | Stack and delivery cadence do not match |

## Consequences

### Positive

- The WebView can host the CAS / MFA login and export cookies from the same session, giving REQ-002 a clear session source;
- CA install / uninstall and the risk notice have a single home, making the "reversible" requirement of NFR-005 and G-003 visible;
- Window, tray, system-proxy and certificate interactions across macOS / Windows concentrate in Electron plus the OS-adaptation layer, containing NFR-006 differences.

### Negative

- Package size grows (Electron runtime stacked on the Python / mitmproxy sidecar, see ADR-0002);
- The UI layer must maintain a security boundary (preload exposing a controlled API, see [electron-ipc.md](../../api/electron-ipc.md)).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| macOS permission prompts (accessibility / network extension / trust settings) scare users away (R4) | Medium | Medium | Guide users step by step in the UI, explaining purpose and how to revoke; give a concrete procedure in the error state |
| Package size inflates from Electron plus Python | Medium | Low | Settle the size approach during packaging; size is not a Phase 1 acceptance blocker |

## References

- Related requirements: REQ-001, REQ-002, REQ-005, REQ-009, REQ-010, REQ-011, G-002, NFR-005, NFR-006, NFR-007
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- Related ADRs: [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.en.md) (the Python / mitmproxy sidecar is distributed by the app), [ADR-0004](ADR-0004-refuse-start-when-system-proxy-in-use.en.md) (a proxy conflict is blocked by a GUI modal)
- Source (archived package, historical provenance only): [04-architecture-and-tech-selection.md §2 ADR-3, §3 technology comparison](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
