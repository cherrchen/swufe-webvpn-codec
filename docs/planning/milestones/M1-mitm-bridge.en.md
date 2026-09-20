# M1: Bridge Core

> Status: Planned
> Owner: cherrchen
> Target: TBD (the original package defines no date)
>
> Chinese source of truth: [M1-mitm-bridge.md](M1-mitm-bridge.md)

## Goal

Make the bridge work end to end without a desktop shell first, so the rewrite logic is correct and regression-tested:

- mitm project skeleton + thin WRD addon: build a WebVPN URL for requests that match the allowlist, change the upstream to `webvpn.swufe.edu.cn`, attach the WebVPN cookies (REQ-006);
- Response reverse rewrite is mandatory: `Location`, `Set-Cookie` Domain/Path, absolute in-app URLs inside HTML/JS/JSON (REQ-007);
- Rewrite allowlist hosts only, everything else goes direct; login-related hosts are never wrapped twice (REQ-005, REQ-008);
- L0/L1 automated tests can be re-run reliably.

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M0 (done) |

## Exit criteria

- [ ] `curl` through the local bridge + a real or simulated WebVPN reaches an allowlist host successfully (TC-F01, P0)
- [ ] A non-allowlist host is not rewritten and keeps direct-connection semantics (TC-F02, P0)
- [ ] L0 passes: codec vectors (TC-A01..TC-A05) and allowlist matching functions (TC-B01..TC-B04)
- [ ] L1 passes: the addon rewrites requests and reverse-rewrites responses against recorded traffic / a fake upstream (including `Location` reverse rewrite, TC-F03)
- [ ] Response rewrite precedence implemented: `Location` → `Set-Cookie` Domain/Path → absolute URLs in HTML/JS/JSON → other content types untouched (REQ-007)
- [ ] Loop prevention holds: `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` and requests already in WebVPN form pass through (REQ-008)
- [ ] Affected documents are synced (including bilingual pairs); no blocking defects

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | A missed rewrite sends the browser to an unreachable address, so G-001 fails | Layered response rewriting (navigation path first); degrade to a bookmark-style WebVPN URL fallback if needed |
| R2 Cookie field changes (medium/high) | Session injection stops working and rewritten requests are treated as unauthenticated | Session probing and cookie reading live in one place (the Session Broker), enabling fast patches and re-login |
| R6 Default key rotation (low/medium) | Rewriting and decoding fail | `wrdKey`/`wrdIv` are config-overridable with hot reload (see [ADR-0005](../../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)) |

## Completion record

Not started yet; the completion time, evidence (commands and result summaries) and remaining issues are recorded here once it is done.
