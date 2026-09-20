# ADR-0004: Refuse to start when the system proxy is already in use

> Chinese source of truth: [ADR-0004-refuse-start-when-system-proxy-in-use.md](ADR-0004-refuse-start-when-system-proxy-in-use.md)

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

The first traffic-capture path of the local bridge points the system HTTP/HTTPS proxy at the local bridge port (REQ-003): read the OS proxy settings before starting, set `127.0.0.1:<bridge_port>`, store a "set by this app" flag, and clear it on stop / session expiry / exit only when that flag is present (NFR-004). Target users, however, very often run Clash / mihomo / sing-box alongside, and those tools contend for the same system proxy setting.

Stacked with another proxy, the traffic path becomes "browser → third-party proxy → bridge → WebVPN" or the reverse: behaviour is hard to reproduce and hard to test, and when something breaks it is impossible to tell which layer rewrote or dropped the request. Silently overwriting the user's proxy settings both destroys their existing routing/acceleration and violates NFR-004's "no half-open proxy" requirement. Phase 1 explicitly does not coexist with those tools (non-goal list), so conflict handling on the start path must be fixed now.

## Decision

Detect the system proxy state before starting the bridge; **if the system proxy is enabled and was not set by this app (does not point at the bridge port), refuse to start the bridge** and tell the user to close Clash / mihomo / sing-box or a similar proxy tool first.

- Detection timing: before every `startBridge` call, with no caching of the previous result;
- On conflict, return the `PROXY_CONFLICT` error code and let the UI block progress with a modal notice (see [main-window.md](../../ui-ux/main-window.md));
- Clear only proxies set by this app: restore the system proxy on stop / expiry / exit only when the "set by this app" flag exists (NFR-004);
- Never silently overwrite the user's proxy settings;
- Chained coexistence is out of Phase 1 scope; supporting it requires a new ADR superseding this one;
- Owner: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (no conflict detection, just set the system proxy) | Zero implementation cost; one action starts the bridge | With Clash / mihomo / sing-box stacked on top the traffic path is uncontrollable and hard to reproduce; a half-open proxy may survive exit | Violates NFR-004 and the stacking problem is untestable |
| Chained coexistence with other proxies (bridge and third-party proxy in series) | Users keep their existing routing / acceleration | Requires defining layer order, routing boundaries and each side's certificate trust; combinatorial explosion, hard to test; no Phase 1 acceptance criterion | Hard to test; out of scope for Phase 1 (non-goal list) |
| Silently overwrite the user's system proxy settings | Invisible to the user; one click starts the bridge | Breaks the user's existing proxy tools and routing rules, and restoration on exit depends entirely on the app | Dangerous, and violates NFR-004 ("no half-open proxy") |

## Consequences

### Positive

- Simple and deterministic: detect → refuse → prompt, with no intermediate state;
- A single traffic path makes rewriting problems attributable and gives L2/L3 tests a clear criterion (the TC-C case group);
- Consistent with NFR-004: only the proxy this app set is managed, leaving user configuration intact.

### Negative

- Users must close other proxy tools before starting the bridge; switching cost lands on them;
- Phase 1 cannot coexist with "using Clash / mihomo / sing-box at the same time", which must be stated up front in the copy.

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Users misread the conflict notice and conclude the app is broken | Medium | Medium | The modal gives the actionable instruction "close Clash / mihomo / sing-box and retry", and advanced settings show the current system proxy state |
| A conflict is detected but the third-party tool later releases the proxy; the user still has to restart the bridge | Low | Low | The conflict notice offers a retry; never poll or grab proxy settings in the background |

## References

- Related requirements: REQ-003, REQ-004, NFR-004
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- Related ADRs: [ADR-0001](ADR-0001-wrd-rewrite-in-mitm-layer.en.md) (kernel-level coexistence is likewise outside Phase 1 scope)
- Source (archived package, historical provenance only): [04-architecture-and-tech-selection.md §2 ADR-4](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
