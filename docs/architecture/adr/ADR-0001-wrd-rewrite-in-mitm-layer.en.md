# ADR-0001: Do not implement WRD rewriting inside the sing-box / mihomo kernel

> Chinese source of truth: [ADR-0001-wrd-rewrite-in-mitm-layer.md](ADR-0001-wrd-rewrite-in-mitm-layer.md)

## Status

`Accepted`

## Date

`2026-09-20`

## Decision Owners

`cherrchen`

## Context

The local bridge must rewrite ordinary HTTP/HTTPS requests for allowlisted hosts (by default necessarily including `jwxt.swufe.edu.cn`) into the Wengine WebVPN URL form — `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`, where only the hostname is encrypted and path/query stay in clear text — and attach the WebVPN session cookie; responses must be rewritten back in priority order (REQ-006, REQ-007).

WebVPN is an **application-layer reverse proxy**, not an SSLVPN/TUN. Rewriting has to happen where the full HTTP semantics (method, URL, headers, body) are readable and writable. Kernels such as sing-box / mihomo operate at the TUN or transparent-proxy layer and only see the CONNECT target host and port; they cannot rebuild HTTP semantics into a WebVPN path.

Constraints: Phase 1 acceptance hard-depends on a local browser being able to open and operate the academic-affairs site (G-001); NFR-001 forbids building a custom proxy kernel / TLS / PKI; NFR-006 states that TUN / transparent gateway does not block Phase 1 acceptance and belongs to later phases (PR-005). The layer that owns rewriting must therefore be fixed now, or the bridge core and future split-routing capability will become entangled.

## Decision

Implement WRD request rewriting and response reverse-rewriting exclusively in the mitm layer (mitmproxy Regular proxy / local capture plus a thin WRD addon); do **not** implement that rewriting inside any TUN / split-routing kernel.

- Do not put WRD semantics into the configuration, plugins or rules of sing-box, mihomo or an equivalent kernel;
- When sing-box is introduced in a later phase, its responsibility is limited to TUN capture and local split routing, forwarding matched traffic to the local bridge port (`127.0.0.1:<bridge_port>`); the kernel has no knowledge of WebVPN semantics;
- Scope: every traffic-rewriting path of the local bridge, in force from Phase 1 onward;
- Implementing rewriting in another layer requires a new ADR superseding this one;
- Owner: cherrchen.

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (no local rewriting; users keep hand-building WebVPN URLs) | Zero development cost; no new risk surface | Cannot satisfy G-001 (browser opens and operates the academic-affairs site); PR-001..PR-003 all fail | Requirement unmet; Phase 1 would deliver no value |
| Implement WRD rewriting directly inside the sing-box / mihomo kernel | No extra MITM component; routing and rewriting in one process | The kernel only sees the CONNECT target host and cannot rewrite HTTP semantics into a WebVPN path; patching the kernel or writing a plugin ties the solution to kernel versions and plugin APIs | Technically infeasible |
| TUN plus a user-space HTTP rewriting library (kernel only routes, the library rewrites) | Kernel and rewriting decoupled; can reuse a mature HTTP library | Requires integrating/building user-space rewriting and TLS handling; complexity rises sharply and conflicts with NFR-001 | Too complex; deferred to a later phase (PR-005) |

## Consequences

### Positive

- Rewriting lives where full HTTP semantics are available, so REQ-006 and REQ-007 close inside one addon;
- Routing and rewriting are decoupled: introducing TUN routing later does not touch the rewriting implementation;
- Consistent with NFR-001: the proxy kernel is out of self-build scope.

### Negative

- Phase 1 depends on a MITM CA: HTTPS rewriting requires trusting a local CA and decrypting traffic (REQ-010, NFR-005);
- Without TUN, non-HTTP(S) traffic and processes that ignore the system proxy are outside Phase 1 coverage (REQ-011 / the non-goal list).

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Users refuse to install the local CA, or forget to reinstall after uninstalling | High | Medium | Show the risk notice required by NFR-005 at install time; surface an actionable `CA_MISSING` error; provide one-click install / uninstall (REQ-010) |
| Later sing-box TUN integration becomes complex to join with the mitm layer | Medium | Medium | No TUN in Phase 1 — stabilise the bridge and rewriting first; review the TUN design separately in a later phase (PR-005) |

## References

- Related requirements: REQ-006, REQ-007, REQ-010, NFR-001, NFR-006
- Related spec: [specs/001-phase1-local-bridge/spec.md](../../../specs/001-phase1-local-bridge/spec.md)
- Related ADRs: [ADR-0002](ADR-0002-reuse-mitmproxy-for-tls.en.md) (reusing mitmproxy for MITM capability; jointly a precondition of the rewriting layer)
- Source (archived package, historical provenance only): [04-architecture-and-tech-selection.md §2 ADR-1](../../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/01-requirements/04-architecture-and-tech-selection.md)
