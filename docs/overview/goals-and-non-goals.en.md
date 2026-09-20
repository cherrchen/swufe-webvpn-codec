# Goals and Non-goals

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [goals-and-non-goals.md](goals-and-non-goals.md)

**Purpose**: state what the project will and will not do, to resist scope creep.
Before implementing anything, an agent should be able to decide from this file whether the work is in scope.

---

## Goals

| ID | Goal | Success criterion | Status |
| -- | ---- | ----------------- | ------ |
| G-001 | Local HTTP/HTTPS clients reach allowlisted hosts through the WebVPN automatically once the official WebVPN login is complete | With the bridge on and the CA trusted, a local browser can open and operate the `jwxt.swufe.edu.cn` (academic-affairs) pages | Open |
| G-002 | Usability: everyday use is low friction and does not require the user to understand the rewrite mechanism | From "logged in" to "browser showing the academic-affairs site" in ≤ 3 clicks (excluding the CAS login itself) | Open |
| G-003 | Security: credentials and the trust chain stay under control, and dangerous actions are reversible | No password written to disk; the CA can be uninstalled in one click; no system proxy left behind after the bridge is stopped | Open |
| G-004 | The architecture stays open-sourceable later (private use first; listed in the source package as milestone M5 "documentation and open-source preparation", optional) | Deliverables contain no private credentials or non-redistributable assets; open-source material can be completed separately in M5 and does not block Phase 1 acceptance | Open |

## Non-goals

> A non-goal is not "maybe later"; it is "explicitly not now, and an agent must not add it on its own".

| ID | Non-goal | Reason | Escalation path if needed |
| -- | -------- | ------ | ------------------------- |
| NG-001 | SSH / databases / SMB / arbitrary TCP·UDP | WebVPN is an application-layer reverse proxy; the local bridge covers HTTP/HTTPS only | New feature spec (TUN / transparent-gateway direction) |
| NG-002 | Replacing the university SSLVPN or a TUN-level real VPN | TUN/sing-box is a later stage and is not part of Phase 1; it does not block Phase 1 acceptance | New feature spec + new ADR |
| NG-003 | Chained coexistence with Clash / mihomo / sing-box system proxies | Chaining is hard to test; Phase 1 refuses to start when a system proxy is already in use | New ADR |
| NG-004 | PAC | Phase 1 traffic takeover has only two modes: system HTTP/HTTPS proxy and per-process capture | New feature spec |
| NG-005 | Storing passwords or auto-filling them to bypass MFA | CAS/MFA must be completed by the user in the official WebView, and passwords must never be stored | Explicit authorisation (product and security review; an agent must not add this) |
| NG-006 | Class-wide distribution, app-store listing | Phase 1 targets private use and does not design an installation/signing flow for bulk distribution | Later stage M5 / new feature spec |
| NG-007 | Linux | Phase 1 supports macOS and Windows only | Later stage / new feature spec |
| NG-008 | Guaranteeing that all certificate-pinning applications work | MITM cannot cover pinned applications; Phase 1 acceptance only requires browser access to the academic-affairs site | New feature spec |

## Relationship to the roadmap

Goals are defined here; timing and ordering live in [planning/roadmap.md](../planning/roadmap.md) and are not duplicated here.

## Change process

Changing goals or non-goals is a requirement change:

1. Update this file;
2. Update affected requirement entries in [requirements/](../requirements/README.md);
3. Assess whether an ADR is needed if the architectural direction changes;
4. Explain it in the PR's Documentation Impact section.
