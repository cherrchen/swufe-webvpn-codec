# M1: Bridge Core

> Status: Done
> Owner: cherrchen
> Target: TBD (the original package defines no date) | Completed 2026-09-21
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
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | In Progress | M0 (done) |

## Exit criteria

- [x] `curl` through the local bridge + a real or simulated WebVPN reaches an allowlist host successfully (TC-F01, P0) — fake upstream: `bridges/python/tests/l2/test_proxy_end_to_end.py`; real `webvpn.swufe.edu.cn`: see the manual smoke in "Completion record" (returns the portal login 302, no real session)
- [x] A non-allowlist host is not rewritten and keeps direct-connection semantics (TC-F02, P0) — L2 asserts both the body and the upstream cookie are empty
- [x] L0 passes: codec vectors (TC-A01..TC-A05) and allowlist matching functions (TC-B01..TC-B04) — 74 passed
- [x] L1 passes: the addon rewrites requests and reverse-rewrites responses against recorded traffic / a fake upstream (including `Location` reverse rewrite, TC-F03) — 74 passed
- [x] Response rewrite precedence implemented: `Location` → `Set-Cookie` Domain/Path → absolute URLs in HTML/JS/JSON → other content types untouched (REQ-007) — `bridges/python/swufe_bridge/addon.py` runs them in order and reports through `swufe-debug.detail`
- [x] Loop prevention holds: `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` and requests already in WebVPN form pass through (REQ-008) — L1 `test_ec_004_*`
- [x] Affected documents are synced (including bilingual pairs); no blocking defects — `pnpm run docs:check` 0 error / 0 warning

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | A missed rewrite sends the browser to an unreachable address, so G-001 fails | Layered response rewriting (navigation path first); degrade to a bookmark-style WebVPN URL fallback if needed |
| R2 Cookie field changes (medium/high) | Session injection stops working and rewritten requests are treated as unauthenticated | Session probing and cookie reading live in one place (the Session Broker), enabling fast patches and re-login |
| R6 Default key rotation (low/medium) | Rewriting and decoding fail | `wrdKey`/`wrdIv` are config-overridable with hot reload (see [ADR-0005](../../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)) |

## Completion record

**Completion time**: 2026-09-21 (macOS arm64 / Python 3.13 / uv 0.11.3).

### Deliverables

| Category | Contents |
| ---- | ---- |
| Tooling | `bridges/python/pyproject.toml` + `bridges/python/uv.lock` + `bridges/python/.python-version` (runtime `mitmproxy==12.2.3`, `cryptography==48.0.1`; dev `pytest==9.1.1`) |
| Implementation | `bridges/python/swufe_bridge/wrd_codec.py` (T003), `bridges/python/swufe_bridge/allowlist.py` (T005), `bridges/python/swufe_bridge/config.py` (T006/T012 data layer), `bridges/python/swufe_bridge/rewrite.py` (T009–T011 logic layer), `bridges/python/swufe_bridge/addon.py` (T008–T012), `bridges/python/swufe_bridge/sidecar.py` (T007) |
| Control plane | Option A finalized: config-file hot reload + `swufe-ready` / `swufe-error` / `swufe-debug` stderr lines + exit codes ([bridge-control-protocol.md](../../api/bridge-control-protocol.md)); `--listen-host 127.0.0.1` hard-coded by the sidecar (no switch) |
| Tests | `bridges/python/tests/l0/` (codec/allowlist/config), `bridges/python/tests/l1/` (request rewrite, response reverse rewrite, log minimization, config hot reload), `bridges/python/tests/l2/` (real mitmdump + curl + fake upstream) |
| CI | [.github/workflows/python-tests.yml](../../../.github/workflows/python-tests.yml): every PR / main push runs `uv sync --frozen --directory bridges/python` + `uv run --directory bridges/python pytest tests/l0 -q` (T034) |

### Verification commands and results (2026-09-21)

| Command | Result |
| ---- | ---- |
| `uv sync --frozen --directory bridges/python` | passed (lock matches pyproject; 48 packages checked) |
| `uv run --directory bridges/python pytest tests/l0 -q` | **74 passed** |
| `uv run --directory bridges/python pytest tests/l1 -q` | **74 passed** |
| `uv run --directory bridges/python pytest tests/l2 -q` | **6 passed** |
| `uv run --directory bridges/python pytest -q` | **154 passed** |
| `uv run --directory bridges/python python -m swufe_bridge.wrd_codec decode '<authserver sample URL>'` | `https://authserver.swufe.edu.cn/authserver/login?service=http%3A%2F%2Fjwxt.swufe.edu.cn%2Fsso%2Fjziotlogin` (exit code 0) |
| `pnpm run docs:check` | 0 error / 0 warning (links + bilingual pairs + spec structure) |
| `pnpm run typecheck` | no error |

### Manual dev smoke (real and fake upstream)

Fake upstream (`http://127.0.0.1:18090` simulating the WebVPN, `webvpnBase` pointing at it):

```text
swufe-ready {"listen_host": "127.0.0.1", "listen_port": 18082, "config": "...", "allowlist": ["jwxt.swufe.edu.cn"], "cookies": 1, "debug": true}
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "request", "detail": null}
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "response", "detail": "location"}
# fake upstream observed: path=/https/7772...7752/sso/jziotlogin?x=9  cookie=wrdvpn_session=SMOKE-SESSION-VALUE
# curl response: HTTP/2 302, location: https://jwxt.swufe.edu.cn/next (Location reverse rewrite works)
```

Config hot reload (no restart; after writing a new config file the next request takes effect): after the cookie changed from "a config entry with a domain" to "a config entry with no domain", the next request in the same process reached the upstream with `wrdvpn_session=SMOKE-SESSION-VALUE`.

Real `webvpnBase` (`https://webvpn.swufe.edu.cn`, no real WebVPN session):

```text
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "request", "detail": null}
[warn] server connect webvpn.swufe.edu.cn:443
swufe-debug {"host": "jwxt.swufe.edu.cn", "rewritten": true, "direction": "response", "detail": "set-cookie"}
GET https://webvpn.swufe.edu.cn/https/7772...7752/sso/jziotlogin  →  HTTP/2.0 302 Found
# curl: location: https://webvpn.swufe.edu.cn/login (WebVPN portal login page; by design not rewritten, i.e. M2's session-expiry signal)
```

That is: the rewritten request does land on the real `webvpn.swufe.edu.cn` (the upstream sees the WRD form), the upstream returns the portal login 302 when unauthenticated, and that response's `Set-Cookie` triggered the reverse rewrite, matching the real upstream behavior. Page-level reachability under a real session is still verified by L3 (M4).

### Implementation-time decisions and deviations (record)

| Item | Conclusion and rationale |
| ---- | ---- |
| Upstream connection strategy | The sidecar pins `--set connection_strategy=lazy`. mitmproxy's default is eager, which dials the **original** host before the request rewrite: it both leaks a direct connection to an allowlist host and hangs the first navigation when that route is blocked (measured 60s with no response in the M1 manual smoke). With lazy, the only upstream connection is the rewritten WebVPN host |
| Cookie injection domain rule | A cookie is injected when its domain is the upstream WebVPN host or a parent domain thereof (`.swufe.edu.cn` covers `webvpn.swufe.edu.cn`; `jwxt.swufe.edu.cn` does not), consistent with browser send semantics |
| How the loopback constraint is verified | L2 cannot directly assert that "connecting to a local non-loopback address must fail": the test machine runs a TUN-style proxy tool (`198.18.0.1`) that accepts connections to any address. Instead it asserts that "at least one real NIC address refuses the connection" (a TUN address being accepted does not affect the verdict); without an external network/TUN environment the simple probe is the fallback |
| Not covered | The `ctx.master.shutdown()` fallback (`LISTEN_NOT_LOOPBACK`) is kept but was not triggered in L2; under option A, loopback is authoritatively enforced by the sidecar hard-coding |

### Remaining questions (handed over to M2–M4)

- Q-001 The session cookie name and the expiry signal still need confirmation on real hardware (M2's Session Broker + L3).
- Q-002 The sidecar distribution form (embedded Python / external mitmproxy) is still open (M4).
- Reachability and non-jumping navigation of real academic-affairs pages under a real session belong to L3 (M4, TC-G01/TC-G02/TC-G03).
- CA install/uninstall (TC-E01/TC-E02) and process capture (TC-G04) need administrator privileges and the Electron shell, so they belong to M2–M4.
