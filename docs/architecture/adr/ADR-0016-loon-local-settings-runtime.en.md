# ADR-0016: Loon local Settings and shared plugin runtime

> Status: Accepted  
> Date: 2026-10-01  
> Owner: cherrchen  
> Chinese source of truth: [ADR-0016](ADR-0016-loon-local-settings-runtime.md)

## Context

Spec 003 M3 requires Loon and Stash to keep site routing, Gateway Session and safe Trace behavior aligned. The user confirmed reuse of the local Settings page. Loon's public Script API has no secure random contract; JavaScriptCore Web Crypto cannot be assumed and weak randomness is unacceptable.

## Decision

1. `packages/webvpn-plugin-runtime` contains host-independent page resources, session orchestration, response context derivation and Trace. It depends only on Core and an injected runtime, with no host globals. Adapters map native APIs. Stash's navigation redirect remains exclusive to its request entry.
2. Loon uses the local Settings V2 page and synthetic API with exact hostname routing. No BoxJS, remote runtime page or server is added. Each host uses its own persistent store; Cookies are not shared across hosts.
3. In Safari's secure HTTPS context, the page generates a 128-bit Web Crypto nonce and submits it in `X-SWUFE-Settings-Bootstrap` on Settings GET. The adapter requires the exact HTTPS origin/API path, exact Settings page Referer, no conflicting Origin and 32 hexadecimal characters. Otherwise the API remains unavailable.
4. Core stores and returns the nonce. POST retains one-use token, two-minute TTL, source, JSON, 16 KiB and schema/hostname validation. All Settings requests, unknown paths and errors terminate locally, with no CORS permission. Headers, nonce, Settings body and Session values never enter diagnostics.
5. Bootstrap relies on same-origin isolation and custom-header preflight. Cross-site pages cannot read the synthetic API or submit a bootstrap that passes source validation. It does not defend against a compromised same-origin page, device or host. Missing secure randomness or trusted Referer fails closed; there is no weak-random or external-random fallback.
6. The plugin uses Build 983+ Script syntax. Settings requests come first; ordinary requests do not read bodies; raw authserver responses read only headers; textual and header-only response rules are separate. Arguments override only enabled and safe debug; site settings come from the local page.
7. QUIC rejection is limited to the SWUFE suffix to attempt TCP fallback. Wildcard MitM defines local Interception Scope, while the site list defines exact Routing Scope. Native Gateway responses never self-promote. Loon URL semantics, QUIC, Settings source/size boundaries and E2E require independent device verification.

## Consequences

- Shared behavior avoids duplicated business/session policy. Existing Stash regression tests must pass after extraction.
- Loon has a different nonce source. ADR-0014 remains valid for Stash; this decision extends Loon/shared boundaries without superseding existing security policy.
- Tests and official documentation do not replace device acceptance. Spec 003 remains In Progress until device and M4 gates pass.

## References

- [Spec 003 design](../../../specs/003-ios-proxy-client-plugins/design.md), [interfaces](../../../specs/003-ios-proxy-client-plugins/interfaces.md)
- [ADR-0014](ADR-0014-stash-local-settings-and-routing-scope.en.md), [ADR-0015](ADR-0015-session-realm-and-proxy-reuse.en.md)
- [Loon Plugin](https://nsloon.app/docs/Plugin/), [new Script syntax](https://nsloon.app/docs/Script/script_v2/), [Script API](https://nsloon.app/docs/Script/script_api/): syntax and native contracts
