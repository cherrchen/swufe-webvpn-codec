# Functional Requirements

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-20
>
> Chinese source of truth: [functional-requirements.md](functional-requirements.md)

**Purpose**: the complete, verifiable list of functional requirements and their source of truth.
**Do not write**: implementation approach, component design, interface field definitions (→ [architecture/](../architecture/README.md), [api/](../api/README.md)).

---

## Requirement template

Copy this block when adding a requirement; IDs increase monotonically and are never reused.

```markdown
### REQ-001 <name>

- Status: Proposed
- Priority: Must
- Related: G-xxx / ADR-xxxx
- Source: <source: requester, interview or document path>

**Description**
The system shall …

**Rationale**
…

**Acceptance criteria**
1. When …, the system shall …
2. When …, the system shall …

**Boundaries and exceptions**
- …

**Related spec**
- specs/<id>-<name>/
```

## Requirement list

| ID | Name | Priority | Status | Related spec |
| -- | ---- | -------- | ------ | ------------ |
| REQ-001 | Electron app shell | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-002 | Login and session (Session Broker) | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-003 | Traffic takeover (pre-TUN) | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-004 | Coexistence with other proxies (refuse to start) | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-005 | Allowlist routing | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-006 | WRD request rewriting | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-007 | Response reverse rewriting | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-008 | Loop prevention (login WebView bypasses the bridge) | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-009 | Observability (status and debug log) | Should | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-010 | Certificate lifecycle | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |
| REQ-011 | Platform support | Must | Accepted | [001-phase1-local-bridge](../../specs/001-phase1-local-bridge/) |

(Expand full entries inline using the template above.)

### REQ-001 Electron app shell

- Status: Accepted
- Priority: Must
- Related: G-002 / G-003 / [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-1

**Description**
The system shall provide a desktop window on macOS / Windows (a tray icon is optional) with these UI capabilities: login (an embedded BrowserWindow/WebView opening the official WebVPN/CAS, where the user completes authentication themselves, including MFA), a one-click connection switch, a first-level capture-mode choice (system proxy / selected apps), allowlist management (view/add/remove hosts, containing `jwxt.swufe.edu.cn` by default, with an optional one-click `*.swufe.edu.cn` toggle), a status area (connected / disconnected / error reason, plus a summary of the current allowlist), certificates (one-click install and one-click uninstall of the local MITM root CA), and a debug-log switch with a log panel.

**Rationale**
CAS/MFA and certificate-trust onboarding require a GUI (see ADR-0003); "state visible, dangerous operations reversible" is product goal G-003.

**Acceptance criteria**
1. The app builds and starts on both macOS and Windows and shows the main window.
2. The status bar matches the bridge state machine: grey and switch disabled when not logged in; blue "logged in" and switch enabled when logged in but bridged off; green "bridging" and switch enabled when running (shown as "bridging (process capture)" while selected-apps capture is active); red with a reason on error; orange and force-off while handling expiry (TC-H01).
3. The allowlist can add and remove hosts, and the change survives an app restart (TC-B05).
4. The `*.swufe.edu.cn` wildcard toggle can be saved (TC-H02).
5. The certificate section offers both "install local CA" and "uninstall local CA", each with a clear label.

**Boundaries and exceptions**
- A tray icon showing connection state is not required in Phase 1.
- A dark theme is not forced (following the system is optional).
- Errors must not be communicated by colour alone.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-002 Login and session (Session Broker)

- Status: Accepted
- Priority: Must
- Related: G-001 / G-003 / [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-2

**Description**
The system shall not store student IDs or passwords, and shall only read and keep the cookies required for the WebVPN session (plus the minimal auxiliary state the implementation needs). Login success means "a usable WebVPN session is obtained reliably" (the exact cookie names are to be confirmed against the real service). On session expiry the system shall: stop the bridge, clear the system proxy it set, stop process capture, and prompt the user to log in again.

**Rationale**
No password on disk is a security baseline (G-003); stopping the bridge explicitly on expiry avoids leaving a half-open proxy.

**Acceptance criteria**
1. After the user completes CAS inside the WebView (MFA may be involved), `loggedIn=true` and no password file exists in the user directory (TC-D01).
2. Starting the bridge while not logged in returns `NOT_LOGGED_IN` (TC-D02).
3. After an expiry signal (probe URL returns the login-page marker / `Set-Cookie` clears the session / repeated rewriting ends in a 302 to CAS), the system stops the bridge, clears the system proxy, stops process capture, and shows a "go to login" prompt (TC-D03).
4. Session cookie values never appear in cleartext in logs or control-port responses.

**Boundaries and exceptions**
- If the validity of the cookies cannot be checked silently, the user is asked to log in again.
- The exact cookie names and expiry signals are to be confirmed against the real service (see [PQ-001](product-requirements.md)).

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-003 Traffic takeover (pre-TUN)

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md) / [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-3

**Description**
The system shall offer two **mutually exclusive** takeover modes, chosen explicitly from the first-level "capture mode" control in the UI: `System proxy (all traffic)` — point the system HTTP/HTTPS proxy at the local bridge port; `Selected apps` — capture only the chosen applications with mitmproxy local mode. The two never hold at once: in selected-apps mode the app does not set a system proxy (and revokes one it set earlier), and in system-proxy mode process capture stays off. Turning the switch off must stop the proxy service, clear the system proxy, and stop process capture.

**Rationale**
Phase 1 does not implement a TUN/transparent gateway. The system proxy covers ordinary browsers; per-process capture narrows the scope to the apps the user picks and leaves the system proxy to the user's own tools. The exclusion is required: a captured app's connection that also went through the system proxy would enter the proxy core as a transparent-layer stream and fail hard.

**Acceptance criteria**
1. With a logged-in session, no system proxy, and the CA ready, turning the bridge on in system-proxy mode points the system HTTP/HTTPS proxy at the local bridge port (TC-C02).
2. After the switch is turned off, the system proxy no longer belongs to this app (TC-C03).
3. Candidate apps can be listed (one row per app, a process merged with its helpers) and selected for capture (e.g. Chrome); in selected-apps mode only the chosen apps go through the bridge and the app sets no system proxy, and turning the switch off also stops process capture.
4. Turning the switch on without an installed CA returns `CA_MISSING` or shows an explicit failure message (TC-E03).

**Boundaries and exceptions**
- On macOS, per-process capture may trigger accessibility/network-extension prompts; the UI must guide the user. The first enable must be confirmed in the system prompt; otherwise the UI shows a failure with guidance and a retry button.
- When another tool owns the system proxy, selecting apps is refused with `PROXY_CONFLICT` as well (consistent with REQ-004).
- A capture failure does not change the bridge state (the bridge stays usable); only the reason is shown.
- WebSocket is best-effort and not an acceptance blocker; HTTP/3 should be disabled or fall back to TCP.
- TUN / sing-box transparent gateway is not part of this requirement (see [non-goals](../overview/goals-and-non-goals.md)).

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-004 Coexistence with other proxies (refuse to start)

- Status: Accepted
- Priority: Must
- Related: G-003 / [ADR-0004](../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-4

**Description**
Before starting, the system shall detect whether the system proxy is already occupied by other software; if it is set (and was not set by this app), the system shall refuse to start and tell the user to first close Clash / mihomo / sing-box or whatever occupies the system proxy.

**Rationale**
Layering on top of Clash is hard to test and behaves unpredictably (ADR-0004); chained coexistence is explicitly out of scope for Phase 1.

**Acceptance criteria**
1. Starting the bridge while the OS proxy is enabled returns `PROXY_CONFLICT` and the bridge is not started (TC-C01).
2. The prompt explicitly asks the user to close Clash / mihomo / other VPN system proxies before retrying.
3. Once the user releases the system proxy, starting again succeeds.

**Boundaries and exceptions**
- Only system-proxy occupancy is detected; no chained forwarding is performed.
- A proxy set and marked by this app itself (`systemProxyManagedByApp`) is not treated as a conflict.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-005 Allowlist routing

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-5

**Description**
The system shall send only allowlist hosts (plus the optionally enabled `*.swufe.edu.cn`) through WebVPN rewriting; all other traffic goes direct (not rewritten, not forced into WebVPN). The host that must always be covered in Phase 1 is `jwxt.swufe.edu.cn`; users can add/remove hostnames themselves. The matching rule is `host in hosts` or (wildcard on and either `host == "swufe.edu.cn"` or `host` ends with `.swufe.edu.cn`); `webvpn.swufe.edu.cn` and `authserver.swufe.edu.cn` are hard-coded exclusions.

**Rationale**
Only allowlist hosts need and are allowed to go through WebVPN; sending everything else direct avoids pointless rewriting and reduces risk (G-001).

**Acceptance criteria**
1. A new configuration contains `jwxt.swufe.edu.cn` by default, and the default value is `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}` (TC-B01).
2. With `hosts=["jwxt.swufe.edu.cn"]`, matching `jwxt.swufe.edu.cn` is true (TC-B02) and matching `example.com` is false (TC-B03).
3. With the wildcard enabled, `xxx.swufe.edu.cn` matches (TC-B04).
4. Hosts added or removed via the UI/API survive an app restart (TC-B05).
5. Hostnames are matched exactly as lowercase valid hostnames; on a miss the request goes direct.

**Boundaries and exceptions**
- The wildcard is off by default and must be enabled explicitly by the user.
- Invalid hostnames (not lowercase valid hostnames) are not written into the allowlist.
- Hosts added/removed and the wildcard toggle take effect immediately (no restart) and survive an app restart (TC-B05 / TC-H02).
- Starting the bridge with an empty allowlist returns `ALLOWLIST_EMPTY`.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-006 WRD request rewriting

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md) / [ADR-0005](../architecture/adr/ADR-0005-builtin-wrd-key-with-override.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-6 (request path)

**Description**
For requests matching the allowlist the system shall: identify the target `scheme/host/port/path/query`; use WrdCodec to build the WebVPN URL (AES-128-CFB, `segment_size=128`, default `key = iv = wrdvpnisthebest!`, encrypting the hostname only, leaving path/query in cleartext, with URL shape `https://webvpn.swufe.edu.cn/{http|https}[-{port}]/{iv_hex}{ct_hex}{path}?{query}`); change the actual upstream to `webvpn.swufe.edu.cn` and attach the WebVPN cookie; and adjust `Host`/`Origin`/`Referer` as needed with the minimum necessary changes.

**Rationale**
A proxy core only sees the CONNECT target host and cannot rewrite HTTP semantics into a WebVPN path, so rewriting must happen in the mitm layer (ADR-0001).

**Acceptance criteria**
1. Encoding the academic-affairs sample (e.g. `https://jwxt.swufe.edu.cn/sso/jziotlogin`) yields a fixed token prefix plus ciphertext that decodes back to the original host (TC-A03).
2. Re-encrypting the authserver sample URL produces a token identical to the sample (TC-A02); decoding the sample URL yields the host `authserver.swufe.edu.cn` (TC-A01).
3. `http://host:8080/x` produces the scheme token `http-8080` (TC-A04).
4. Decoding a sample with the wrong key yields a wrong host or an explicit failure (TC-A05).
5. With `curl -x <local proxy> https://jwxt.swufe.edu.cn/...`, the upstream sees WebVPN form or the academic-affairs site is reachable (TC-F01).
6. Non-allowlist hosts (e.g. `example.com`) are not rewritten (TC-F02).

**Boundaries and exceptions**
- The WRD default key is built in with a configuration override (ADR-0005); a mismatched custom key/iv produces garbage or an explicit failure.
- `Host`/`Origin`/`Referer` get only the minimum changes required for correctness.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-007 Response reverse rewriting

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-6 (response path)

**Description**
The system shall (mandatory in Phase 1 — the browser acceptance depends on it) reverse-rewrite the WebVPN-specific parts of responses: `Location`; the `Domain`/`Path` and other host-related fields of `Set-Cookie`; and absolute URLs pointing at campus hosts inside `text/html`, `application/javascript` and `application/json`. Policy: the client side always uses the real hostname; only the upstream hop goes through WebVPN.

**Rationale**
The academic-affairs front end contains many absolute URLs and redirects; without reverse rewriting, clicks jump to unreachable public addresses and browser acceptance cannot pass. Priority: ① `Location` ② `Set-Cookie` Domain/Path ③ absolute URLs in HTML/JS/JSON ④ other content types are left unchanged by default.

**Acceptance criteria**
1. When the upstream returns a WebVPN-form `Location`, the client follows it into ordinary-hostname semantics (TC-F03).
2. Clicking the main menus/links inside the academic-affairs pages does not jump to an unreachable direct public address because of absolute URLs (TC-G02).
3. `Set-Cookie` `Domain`/`Path` stay consistent with the real hostname semantics, so cookies are not written to the wrong domain.
4. Content types other than `text/html` / `application/javascript` / `application/json` are not rewritten by default.

**Boundaries and exceptions**
- WebSocket is best-effort and not an acceptance blocker.
- Whether `Location` is reverse-rewritten to an ordinary URL or kept as a followable consistent form is fixed to one option in the implementation notes, proven against the academic-affairs site.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-008 Loop prevention (login WebView bypasses the bridge)

- Status: Accepted
- Priority: Must
- Related: G-001 / [ADR-0001](../architecture/adr/ADR-0001-wrd-rewrite-in-mitm-layer.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-2 / FR-7 related

**Description**
The system shall ensure that requests to `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` never enter the bridge and are never wrapped by WRD a second time; requests already in WebVPN form pass through untouched. Both hostnames are hard-coded exclusions that allowlist edits cannot affect.

**Rationale**
The login WebView itself talks to the WebVPN portal; rewriting those requests would create a proxy loop and break the login flow.

**Acceptance criteria**
1. Throughout the login WebView flow (including CAS/MFA), packet capture or logs confirm the traffic is not wrapped by WRD again (TC-D04).
2. Requests already in WebVPN form pass through and are not rewritten a second time.
3. Even with the `*.swufe.edu.cn` wildcard enabled, `webvpn.swufe.edu.cn` and `authserver.swufe.edu.cn` remain excluded.

**Boundaries and exceptions**
- The exclusion is hard-coded and unaffected by user allowlist edits.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-009 Observability (status and debug log)

- Status: Accepted
- Priority: Should
- Related: G-002 / G-003
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-7

**Description**
The system shall show connection state, allowlist and error reasons by default, and shall offer a toggleable debug log whose content is only "domain + whether rewriting succeeded". The log is off by default and never records response bodies, request bodies or cookies. The UI presents this as a status bar plus a log panel listing "time | domain | result", shown/hidden with the switch and capped at the 200 most recent records.

**Rationale**
Visible state is part of experience goal G-002 and a prerequisite for troubleshooting; log minimisation is part of security baseline G-003 (cookies are sensitive).

**Acceptance criteria**
1. The status bar display matches the bridge state machine (TC-H01).
2. With debug logging enabled and traffic flowing, log records contain only the host and the rewrite result (TC-F04).
3. Non-allowlist requests show `rewritten=false` in the debug log (TC-F02).
4. Log records have the fields `ts/host/rewritten/direction/detail` and never contain cookies or bodies.
5. The log panel shows the columns "time | domain | result", keeps at most the 200 most recent records, and hides and clears them when the switch is turned off (TC-F04 / AC-009).

**Boundaries and exceptions**
- Debug logging is off by default and enabled explicitly by the user.
- The debug log is for diagnosis, not for auditing or traffic retention.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-010 Certificate lifecycle

- Status: Accepted
- Priority: Must
- Related: G-003 / [ADR-0002](../architecture/adr/ADR-0002-reuse-mitmproxy-for-tls.md) / [NFR-003](non-functional-requirements.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-8

**Description**
The system shall use a locally generated MITM CA (reusing the mitmproxy CA mechanism, not a home-grown PKI), and shall offer one-click installation into the system trust store and one-click uninstall; the CA private key must not be uploaded; the trust risk must be shown before installation.

**Rationale**
Decrypting and rewriting HTTPS requires trusting a MITM root CA on the machine, and dangerous operations must be reversible (G-003). Building a PKI/TLS stack from scratch is costly and risky, hence the mature-stack reuse (ADR-0002).

**Acceptance criteria**
1. After installation the CA is visible in the trust store and the UI shows "installed" (TC-E01).
2. After uninstall the CA is removed from the trust store (TC-E02).
3. Starting the bridge or accessing HTTPS without an installed CA returns `CA_MISSING` or an explicit failure message (TC-E03).
4. The risk notice is shown before installation (see [NFR-005](non-functional-requirements.md)).

**Boundaries and exceptions**
- The CA uses a dedicated mitmproxy confdir; the private key stays local and is never uploaded.
- Installation may require administrator rights (the case may be degraded in CI).
- The open-source documentation must state the trust risk.

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

### REQ-011 Platform support

- Status: Accepted
- Priority: Must
- Related: G-004 / [ADR-0003](../architecture/adr/ADR-0003-electron-gui-for-phase-1.md) / [NFR-006](non-functional-requirements.md)
- Source: archived package / [requirements-onepager-v1.0.md](../archive/2026-09-20-swufe-webvpn-bridge-docs-v1.0/99-appendix/requirements-onepager-v1.0.md) FR-9

**Description**
Phase 1 supports macOS and Windows; Linux is out of scope for Phase 1.

**Rationale**
The product targets desktop-browser use by SWUFE students and staff; two desktop platforms suffice for the private-use-first Phase 1 goal (G-004).

**Acceptance criteria**
1. The Electron app starts on both macOS and Windows and completes the main path (login → bridge on → browser opens the academic-affairs site).
2. Browser acceptance passes on at least one desktop OS (target: both).
3. No Phase 1 deliverable is produced for Linux.

**Boundaries and exceptions**
- Platform differences (system-proxy APIs, trust stores, permission dialogs) are handled by the platform adaptation layer.
- TUN/transparent gateway does not block Phase 1 acceptance (see NFR-006).

**Related spec**
- [specs/001-phase1-local-bridge/](../../specs/001-phase1-local-bridge/)

## Requirement → verification mapping

Per-requirement verification lives in each feature spec's [verification.md](../../specs/001-phase1-local-bridge/verification.md); this file keeps the overview only:

| REQ | Verification method | Status |
| --- | ------------------- | ------ |
| REQ-001 | TC-H01 / TC-H02 / TC-G01 / TC-G03 | Pending |
| REQ-002 | TC-D01 / TC-D02 | Pending |
| REQ-003 | TC-C02 / TC-C03 / TC-C04 | Pending |
| REQ-004 | TC-C01 | Pending |
| REQ-005 | TC-B01..TC-B05 | Pending |
| REQ-006 | TC-A01..TC-A05 / TC-F01 | Pending |
| REQ-007 | TC-F03 / TC-G02 | Pending |
| REQ-008 | TC-D04 | Pending |
| REQ-009 | TC-F04 / TC-H01 | Pending |
| REQ-010 | TC-E01 / TC-E02 / TC-E03 | Pending |
| REQ-011 | Manual platform acceptance (one macOS and one Windows test machine) | Pending |
