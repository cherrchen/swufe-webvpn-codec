# Project Overview

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
>
> Chinese source of truth: [project-overview.md](project-overview.md)

**Purpose**: answer "what is this project, for whom, and where are its boundaries".
It is the first document a newcomer or agent should read, and expands the Project Identity block in [AGENTS.md](../../AGENTS.md).

---

## One-line description

`SWUFE WebVPN Bridge`: an Electron desktop app for macOS / Windows. After the user completes the official Wengine WebVPN login (CAS/MFA) inside the app, local HTTP/HTTPS traffic whose target matches the allowlist is rewritten by the local bridge ([本机桥](glossary.md)) into WebVPN URLs carrying the session, so that a normal local browser can open and operate the academic-affairs site `jwxt.swufe.edu.cn`. It is not a real VPN.

## Background

- Off-campus access to campus web resources relies on the Wengine WebVPN at `webvpn.swufe.edu.cn`; identity goes through `authserver.swufe.edu.cn` (CAS, possibly with MFA).
- WebVPN is an **application-layer reverse proxy**, not an SSLVPN/TUN. URL coding is AES-128-CFB (`segment_size=128`) with default `key = iv = wrdvpnisthebest!` and the shape
  `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{host_cipher}{path}?{query}`.
- Therefore a normal local browser or application cannot transparently reach campus HTTP/HTTPS services under their real internal host names; resources are reachable only through the WebVPN portal and its rewritten URLs.

## Target users

| Role | Description | Main need |
| ---- | ----------- | --------- |
| SWUFE students and staff (developer himself first) | Primary user; off-campus network | Use the local browser off campus to reach allowlisted sites such as the academic-affairs system |
| Future open-source users | Third parties who can self-host and audit | Build their own bridge; audit the implementation and the certificate risk statement |

## Problem being solved

**Today's situation**: off-campus access to campus web resources must go through the official WebVPN (`webvpn.swufe.edu.cn`), with identity handled by `authserver.swufe.edu.cn` (CAS, possibly with MFA). WebVPN is an application-layer reverse proxy rather than an SSLVPN/TUN, so local browsers and applications cannot transparently reach campus HTTP/HTTPS services under their real internal host names.

**The pain**: resources are usable only under WebVPN-shaped URLs; campus sites (especially the academic-affairs system) contain many absolute URLs, so once that shape is left, clicks escape to an unreachable direct connection and cookies may be written to the wrong domain.

**Why now**: Phase 1 pre-research (M0) is complete — WRD URL coding was verified against real-machine URLs by the `wrd_codec.py` prototype, and the requirements specification was aligned with the product owner (2026-09-20); the next step is the M1 bridge core.

## Scope

```text
In scope:     On macOS / Windows, after official WebVPN login, rewrite local HTTP/HTTPS requests
              whose target matches the allowlist into WebVPN shape and attach the session, so that a
              local browser can open and operate the academic-affairs site and similar sites;
              system HTTP/HTTPS proxy takeover + per-process capture; WRD request rewrite and
              response reverse rewrite; MITM CA install/uninstall; allowlist management
              (including the optional *.swufe.edu.cn wildcard); session (cookie) management and
              expiry handling; bridge status and debug logging.
Out of scope: NG-001..NG-008, see goals-and-non-goals.md
```

## Delivery shape

```text
Repository type:  Documentation-first (docs/ + specs/) + the M1 bridge implementation (bridges/python/swufe_bridge/, bridges/python/tests/)
Primary language: Python 3 (bridge sidecar / addon, authoritative WRD codec, see bridges/python/swufe_bridge/)
                  + TypeScript (Electron app, IPC declared in TS; from M2)
                  Docs are Markdown plus Node documentation checks
License:          MIT
Owner:            cherrchen
```

## Key links

| Item | Link |
| ---- | ---- |
| Requirements | [requirements/](../requirements/README.md) |
| Architecture | [architecture/overview.md](../architecture/overview.md) |
| Glossary | [glossary.md](glossary.md) |
| Roadmap | [planning/roadmap.md](../planning/roadmap.md) |
| Phase 1 spec | [specs/001-phase1-local-bridge/spec.md](../../specs/001-phase1-local-bridge/spec.md) |
| External material | [https://webvpn.swufe.edu.cn](https://webvpn.swufe.edu.cn) — Wengine WebVPN portal entry; [https://authserver.swufe.edu.cn](https://authserver.swufe.edu.cn) — unified identity (CAS, possibly MFA) entry. Both are official university systems, not project assets |

## Open Questions

| ID | Question | Impact | Status |
| -- | -------- | ------ | ------ |
| Q-001 | WebVPN session cookie names and expiry signals must be confirmed against the real system | Session Broker session extraction and expiry detection | Open |
| Q-002 | Distribution shape of the mitm sidecar is undecided: embedded Python vs. external mitmproxy executable | Bundle size, install flow, cross-platform shipping | Open |
| Q-003 | The product name "SWUFE WebVPN Bridge" is flagged as provisional in the source package | Documentation, package name and release material | Open |
