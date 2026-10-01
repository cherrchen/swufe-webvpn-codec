# iOS plugin local Settings API

> Status: In Progress ｜ Owner: cherrchen ｜ Last Reviewed: 2026-10-01  
> Chinese source of truth: [ios-plugin-settings.md](ios-plugin-settings.md)

Stash/Loon Script Adapters provide synthetic HTTP responses to the bundled Settings page in Safari. There is no public server or socket listener. Stability is Evolving.

Endpoints, DTOs, errors, migration and nonce contracts are defined once in [Spec 003 interfaces](../../specs/003-ios-proxy-client-plugins/interfaces.md); §17 adds Loon M3 bootstrap/native mapping. Persistence is defined in [data-model](../../specs/003-ios-proxy-client-plugins/data-model.md). This page registers the interface without repeating its definition.

Authorization and local termination boundaries are defined in [ADR-0014](../architecture/adr/ADR-0014-stash-local-settings-and-routing-scope.en.md) for Stash and [ADR-0016](../architecture/adr/ADR-0016-loon-local-settings-runtime.en.md) for Loon. The API never returns Session Cookies, passwords or MFA, and does not import Sessions across hosts.

Compatibility: existing V2 Settings/V1 Session are reused; desktop IPC is unchanged. Loon's new bootstrap header affects only its page; missing trusted sources fail closed. Per-host device evidence remains in [verification](../../specs/003-ios-proxy-client-plugins/verification.md).
