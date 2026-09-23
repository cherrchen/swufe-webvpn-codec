# Follow-up Design Memo: TUN / Transparent Gateway

> Status: Candidate | Owner: cherrchen | Last Reviewed: 2026-09-23

## Purpose and status

This memo collects questions that must be answered when evaluating a future TUN / transparent gateway. It does not define current requirements, an implementation design, or a release commitment. Its basis is [PR-005](../requirements/product-requirements.en.md) and [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.en.md): Phase 1 does not implement TUN; if one is adopted later, the routing kernel must not perform WRD or HTTP content rewriting.

Whether to start a follow-up feature, which kernel to choose, and which platforms to support are all `TBD`. Before implementation, create a Feature Spec and assess ADRs, the security model, and acceptance scope against the actual decisions.

## Known boundaries

- Current traffic takeover uses the system HTTP/HTTPS proxy and per-process capture; there is no TUN takeover.
- WebVPN is an application-layer reverse proxy. Request and response rewriting need HTTP semantics and remain the responsibility of the local bridge's mitm layer.
- [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.en.md) proposed this candidate division of responsibility: a TUN / routing kernel captures and selects traffic, forwarding traffic that needs WebVPN to the local bridge; the kernel does not handle WebVPN, WRD, cookies, or response-body semantics. This is an existing architectural constraint, not a validated TUN design.
- Current product targets are macOS and Windows. TUN platform support, system-extension/driver authorisation, and distribution have not been evaluated.

## Questions for future design

1. **Scope and routing**: Which domains/IPs/protocols go to the local bridge, direct, or get dropped? How can the design avoid requiring an application to resolve a campus hostname that has no public DNS record? Does it cover UDP, IPv6, and local traffic?
2. **TLS and protocol boundaries**: How will only HTTP(S) traffic that needs inspection reach the mitm layer? How will certificate pinning, non-HTTP traffic, and QUIC/HTTP3 be handled? How will unsupported connections be explained to users?
3. **Loops and coexistence**: How will upstream connections from the bridge to WebVPN avoid re-entering TUN routing? How will the design detect conflicts and fail safely with the system proxy, Clash/mihomo/sing-box TUN, or another VPN?
4. **Platform lifecycle**: What permissions, user consent, installation/upgrade/uninstall, crash recovery, and shutdown cleanup are needed for macOS Network Extension and Windows drivers or services? Which OS versions are supported?
5. **Security and privacy**: How will the captured scope be shown and narrowed? How will local listeners, session data, and the CA private key be protected, and unnecessary logging of traffic, DNS, bodies, or cookies be avoided?
6. **Dependencies and distribution**: How will candidate-kernel licences, maintenance, supply chain, cross-platform artifacts, size, signing/notarisation, and update channels be assessed?
7. **Verification**: Which real-machine acceptance cases are needed for macOS and Windows, including routing/DNS/IPv4/IPv6, sleep/resume, conflicts, uninstall, and fault injection?

## Design principles

- Keep TUN / routing separate from WebVPN semantics; do not put WRD encoding/decoding, cookie injection, or response-body rewriting into a TUN kernel.
- Prefer the smallest takeover scope, visible user authorisation, reversible install/uninstall, and cleanup that leaves no proxy or route behind on failure. A future Spec must confirm the concrete requirements.
- Adopting TUN does not promise that arbitrary TCP/UDP will work through the university WebVPN; the WebVPN capability boundary must be checked per protocol.

## Outputs and exit criteria

This memo is not a Feature Spec and does not authorise implementation. If future design work starts, it should produce at least: target users and scenarios, platform and permission model, a traffic-decision table, interface boundaries with the existing bridge, conflict/rollback handling, dependency-licence assessment, and a reviewable real-machine verification plan. Mark every unverified conclusion `TBD`.
