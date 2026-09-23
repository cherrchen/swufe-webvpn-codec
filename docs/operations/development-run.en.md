# Development run

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23
>
> Chinese source of truth: [development-run.md](development-run.md)

**Purpose**: let a developer or acceptance tester start the **real** development build (Electron app plus local mitmproxy sidecar) on a clean machine, and know how to self-check, troubleshoot and fully reset it.
**Scope**: development/acceptance runs on macOS and Windows; Phase 1 ships no installer, so this file describes running from the repository. Configuration keys and storage locations live in [README.md](README.md); the interfaces live in [bridge-control-protocol.md](../api/bridge-control-protocol.md).

---

## 1. Prerequisites

| Item | Requirement | Notes |
| ---- | ----------- | ----- |
| Node.js | ≥ 22 (v24.18.0 verified locally) | Required by both the app (Electron) and the repository scripts (`scripts/`) |
| `uv` | Any recent version | Creates the repository-root Python environment and runs the sidecar/CA entry points |
| Python environment | `uv sync --directory bridges/python` executed at the repository root (produces `bridges/python/.venv/`) | The app starts the bridge with `<repo>/bridges/python/.venv/bin/python -m swufe_bridge.sidecar` by default |
| Platform | macOS or Windows | Linux is out of scope for Phase 1 |
| Network | Reachable `https://webvpn.swufe.edu.cn` | The registrar host `jwxt.swufe.edu.cn` is not directly reachable off campus; WebVPN is required |
| Proxy tooling | **TUN / virtual-interface mode of any other proxy tool must be off** (Clash, mihomo, sing-box, Stash, …) | Measured: TUN fake-ip DNS (`198.18.0.0/15`) makes upstream connections through the bridge hang. Before starting, the gateway host is resolved and a fake-ip answer is refused with `PROXY_CONFLICT` ([ADR-0011](../architecture/adr/ADR-0011-refuse-start-on-fake-ip-dns.en.md)); that preflight only covers the fake-ip shape, so a `redir-host`-mode TUN still has to be turned off by hand (see `KI-013`) |
| Account | The tester's own SWUFE unified-identity account (with MFA) | Never written into the repository |

## 2. First-time setup

```bash
uv sync --directory bridges/python   # creates bridges/python/.venv/ (sidecar, WRD codec, CA entry point)
pnpm install                         # installs every workspace project (repository root + apps/desktop/: Electron / TypeScript / esbuild / tsx)
```

- `pnpm install` does not download the Electron binary: if `apps/desktop/node_modules/electron/dist` is missing, fetch it once with `node apps/desktop/node_modules/electron/install.js`.
- Afterwards the daily command is just `pnpm start` (it builds first, then launches).

## 3. Starting

```bash
pnpm start                                        # default userData
pnpm start --user-data-dir=/tmp/swufe-dev         # isolated profile
```

- `pnpm start` = `pnpm run build && electron .` (the root script forwards to `apps/desktop`); everything after it is passed to Electron unchanged.
  **Never write `pnpm run start -- --user-data-dir=…`**: pnpm inserts its own `--` separator, so Electron receives a literal `--` and stops parsing Chromium switches (e.g. `--remote-debugging-port` silently does nothing).
- An isolated profile (`--user-data-dir`) keeps day-to-day configuration clean and is recommended for acceptance and re-runs; it isolates `config.json`, `bridge-config.json`, the `mitmproxy/` CA and the login partition together.
- Environment variables (equivalent overrides, see [apps/desktop/README.md](../../apps/desktop/README.md)):

| Variable | Effect |
| -------- | ------ |
| `SWUFE_USER_DATA_DIR` | Equivalent to `--user-data-dir <dir>` |
| `SWUFE_REPO_ROOT` | Overrides the repository root (defaults to two levels above the app directory, i.e. the repository root) |
| `SWUFE_PYTHON` | Interpreter for the sidecar / CA entry point (default `<repo>/bridges/python/.venv/bin/python`, falling back to `uv run --project <repo>/bridges/python python`) |
| `SWUFE_PROBE_INTERVAL_MS` | Session-expiry probe interval (default 30000ms; acceptance runs may lower it, e.g. 8000) |
| `SWUFE_RENDERER_URL` | Where the renderer is loaded from: when set, Main switches to `loadURL('<url>/<entry>.html')` with the development CSP (otherwise it loads the static output under `apps/desktop/dist/renderer/*.html`). It affects the renderer load path only — never the bridge, the sidecar or the system proxy |

### 3.1 Renderer development (HMR, from M6)

```bash
pnpm --filter swufe-webvpn-bridge run dev:renderer        # vite dev server, fixed at 127.0.0.1:5173 (strictPort)
SWUFE_RENDERER_URL=http://127.0.0.1:5173 pnpm start       # in a second terminal; renderer edits hot-reload
```

- The renderer is now a React + Ant Design four-window app (`src/renderer/{main,capture,logs,allowlist}.html`) whose build output lives in `apps/desktop/dist/renderer/` (four HTML files plus `assets/*`, including the antd shared chunk).
- **Production and day-to-day runs are unchanged**: still `pnpm start` (it runs `pnpm run build` — `tsc -p tsconfig.json && vite build && pnpm run build:preload` — then `electron .`, loading the static output); `dev:renderer` + `SWUFE_RENDERER_URL` merely avoid a full rebuild and restart while editing renderer code.

## 4. Operations that need administrator rights

| Operation | Platform behaviour |
| --------- | ------------------ |
| Install the local CA | The UI shows a risk notice first; on confirmation two steps run ([ADR-0008](../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)): ① osascript's `do shell script … with administrator privileges` runs `security add-certificates -k /Library/Keychains/System.keychain <caCert>` to put the certificate into the system keychain (**a system administrator authorization dialog appears**; cancelling aborts with no writes); ② the **app process itself** then runs `security add-trusted-cert -d -r trustRoot <caCert>` to write the admin-domain trust settings (no `-k`, so the keychain is untouched; macOS handles the authorization for this app's own session) |
| Uninstall the local CA | Same elevation, running `security delete-certificate -Z <sha1>` (keychain only; an admin-domain trust entry cannot be cleared by the CLI — see the residue note in `KI-010`) |
| Process capture ("selected apps") | On macOS, mitmproxy installs and activates a network extension on first use; the authorization prompt must be **confirmed within 5 seconds**. A timeout fails the attempt and the UI shows guidance plus a "retry" button. Windows requires UAC elevation (see [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)) |

> On Windows, CA installation writes to the **current-user** Root store (`certutil -user -addstore Root <caCert>`) and shows no administrator password prompt; uninstalling is `certutil -user -delstore Root mitmproxy`.

## 5. Verification and self-check

```bash
pnpm run acceptance:check --out <dir> --user-data-dir <profile>
```

- The script collects one redacted acceptance-evidence report (`<dir>/acceptance-<platform>-<timestamp>.md`): OS/version, key fields of `config.json` and `bridge-config.json`, CA files and trust store, the system-proxy state per network service, whether the bridge port is listening, proxied-versus-direct curl control requests, and leftover sidecar processes.
- The report contains **no** cookie value, no `wrdKey` / `wrdIv` value and no `Set-Cookie` / `Cookie` / `Authorization` header value (NFR-003 / INV-001); the trailing `redaction-self-check` section ends the run with `FAIL` (exit code 1) if anything leaked.
- Switches: `--port` (default 8080), `--host` (default `jwxt.swufe.edu.cn`), `--scheme` (default `https`; **the registrar host `jwxt.swufe.edu.cn` can only be proxied by this gateway in its `http` form, so its acceptance run needs `--scheme http`**), `--user-data-dir` (default macOS `~/Library/Application Support/swufe-webvpn-bridge`, Windows `%APPDATA%\swufe-webvpn-bridge`), `--save-body` (off by default; saved bodies may contain personal data and **must not be committed**).
- Platform differences: on Windows the script appends `--ssl-no-revoke` to curl (the bundled curl speaks Schannel and fails on the freshly generated local CA with "the revocation status is unknown", exit code 60); the `runtime-config` / `ca-files` sections report file modes as `INFO` on Windows (POSIX mode bits are synthesized there and do not describe the ACL — the equivalent guarantee comes from the per-user `%APPDATA%` profile ACL).
- The full acceptance procedure (including the registrar browser acceptance and result table) is in [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md), section "M4 双平台验收执行手册"; the measured Windows run is the section "M4 Windows 验收执行记录（2026-09-23）" of the same file. If a report shows nothing but `FAIL bridge-smoke curl 退出码 28`, re-run it once (sporadic upstream stall, `KI-019`) instead of reading it as a bridge failure.

## 6. Common failures

| Symptom | Cause | Action |
| ------- | ----- | ------ |
| Status bar shows "error" with `CA_MISSING` after switching the bridge on | Local CA not installed | Click "install local CA" and enter the administrator password; until then the bridge changes no system setting |
| Bridge start refused with `PROXY_CONFLICT` | Another tool owns the system proxy, or the gateway host resolves into the fake-ip range (`198.18.0.0/15`, TUN mode) | Turn that tool's system proxy **and TUN mode** off first; the conflict modal says so, and this app never modifies settings it does not own |
| Bridge start refused with `NOT_LOGGED_IN` | WebVPN (CAS/MFA) login not completed | Click "log in to WebVPN" |
| Bridge start refused with `ALLOWLIST_EMPTY` | Empty allowlist | Add at least one host, or tick `*.swufe.edu.cn` |
| Login window styling broken / overlapping pop-ups | CAS theme assets are intermittently truncated by the server (`ERR_INCOMPLETE_CHUNKED_ENCODING`, `KI-014`, not an app defect) | Close the login window and click "log in to WebVPN" again to reload it; it cannot be fixed on the product side until the server stabilises |
| Status bar shows "error" with `BRIDGE_CRASH` | The sidecar exited abnormally, or `bridgePort` is taken | Turn on "debug log" to read the bridge output; if the port is taken, change `settings.bridgePort` in `<userData>/config.json` and retry |
| `swufe-error CONFIG_INVALID` | Invalid runtime config (e.g. a comma inside `capture.processes`) | Fix the corresponding setting in `<userData>/config.json` and switch the bridge on again |
| The sidecar does not start / python not found | `bridges/python` was never synced, or `SWUFE_PYTHON` points at a missing interpreter | Run `uv sync --directory bridges/python` from the repository root, or fix `SWUFE_PYTHON` |
| The system proxy still points at the bridge after quitting | The previous run ended with `kill -TERM` / `kill -9`, so the JS cleanup never ran (recorded as a known issue) | The next launch clears it via `recoverOnLaunch()` using the "set by this app" marker; manually: `networksetup -setwebproxystate <service> off` (Windows: set `ProxyEnable` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` to 0) |
| The UI reports "process capture: failed" | Network extension not authorized / authorization timed out (macOS) | Allow it under System Settings → General → Login Items & Extensions as the UI explains, then click "retry". A capture failure does not affect the system-proxy path (the bridge stays "running") |
| The registrar page shows nothing for tens of seconds on first open | Sporadic upstream stall (`KI-019`): the bridge logged the request, the gateway response never arrived; a direct request to the gateway root is fine | Reload the page (or close and reopen it). The same symptom shows up as `curl 退出码 28` in an acceptance smoke run — just re-run it; reproduction data is recorded in `KI-019` |
| Under "selected apps" capture the browser cannot open the registrar (`ERR_NAME_NOT_RESOLVED`) | Process capture does not intercept DNS: the browser must resolve the hostname itself, and `jwxt.swufe.edu.cn` has no public record | Use the default "system proxy (all traffic)" mode for the registrar (the browser hands the hostname to the bridge, which maps it onto the gateway); capture fits hosts that resolve locally |

## 7. Windows differences

| Dimension | Windows behaviour |
| --------- | ----------------- |
| System proxy | Read and written through the WinINET registry (`ProxyEnable` / `ProxyServer` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`), leaving every other setting alone |
| When it takes effect | **No `WM_SETTINGCHANGE` broadcast**: already-running browsers may keep using the previous proxy until restarted |
| CA | Written to the current-user Root store (`certutil -user`), no administrator needed; macOS uses the system keychain — the install elevates for the keychain write and then has the app process write the trust settings (see [ADR-0008](../architecture/adr/ADR-0008-ca-trust-authorization-in-app-session.md)) |
| Process capture | Requires launching the app as administrator (UAC; the `local:` mode redirects the selected processes through pydivert on Windows). Verified: mutual exclusion (the system proxy is untouched while capturing), forward direction (requests of the selected `chrome.exe` go through the bridge), reverse direction (an unselected `curl` connects directly and never appears in the bridge log) — see the "M4 Windows 验收执行记录" section of [verification.md](../../specs/001-phase1-local-bridge/verification.md) |
| DNS under capture | Capture does not intercept DNS: the selected process must resolve the hostname itself, and `jwxt.swufe.edu.cn` has no public record (`ERR_NAME_NOT_RESOLVED`) — use the default "system proxy" mode for the registrar |
| Browser HTTPS upgrade | Chrome / Edge upgrade `http://jwxt.swufe.edu.cn/` to `https://`, which this gateway cannot proxy for the registrar (it answers `/wengine-vpn/failed`); use `--disable-features=HttpsUpgrades` or turn "always use secure connections" off during acceptance |
| curl against the local CA | The bundled curl speaks Schannel and rejects `--cacert <local CA>` with "the revocation status is unknown" (exit code 60): manual commands need `--ssl-no-revoke` (`pnpm run acceptance:check` adds it automatically) |
| File permissions | No POSIX mode-bit semantics (`stat` synthesizes `0o666`); "local user only" for the session file and the CA private key comes from the per-user `%APPDATA%` profile ACL (the Windows implementation of NFR-003) |

> Windows real-machine verification (TC-C02..C04, TC-D01..D04, TC-E01/E02/E03, TC-F01/F04, TC-G03/G04, TC-H01/H02, TC-B05) ran on **2026-09-23** on Windows 11 24H2 and passed; it surfaced `KI-015`..`KI-018`, all fixed, plus `KI-020` (tooling platform assumptions) — see [known-issues.md](../../specs/001-phase1-local-bridge/known-issues.md). The run and its command results are in the "M4 Windows 验收执行记录（2026-09-23）" section of [verification.md](../../specs/001-phase1-local-bridge/verification.md). `KI-019` (sporadic upstream stall) stays Open and matches the handling in section 6 above.

## 8. Stopping and resetting

```text
1. Switch the bridge off (the system proxy is cleared immediately)
2. Quit the app normally (let before-quit finish; never kill -9)
3. Confirm nothing is left behind:
   macOS   : networksetup -getwebproxy <service> → Enabled: No; pgrep -fl swufe_bridge.sidecar prints nothing
   Windows : reg query "HKCU\...\Internet Settings" /v ProxyEnable → 0x0
4. Uninstall the local CA (the UI's "uninstall local CA")
5. For an isolated profile, delete the whole directory (config.json, bridge-config.json, mitmproxy/, login partition)
```

## 9. Related

- Configuration keys and locations ⇒ section 2 of [README.md](README.md)
- App-side commands and limits ⇒ [apps/desktop/README.md](../../apps/desktop/README.md)
- Bridge control protocol (`swufe-ready` / `swufe-error` / `swufe-debug` / `swufe-capture`) ⇒ [bridge-control-protocol.md](../api/bridge-control-protocol.md)
- Security constraints (cookies, CA private key, permissions) ⇒ [security/README.md](../security/README.md)
- Acceptance procedure and result table ⇒ [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)
- Test layers and commands ⇒ [testing-strategy.md](../development/testing-strategy.md)
