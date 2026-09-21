# Development run

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-21
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
| Python environment | `uv sync` executed at the repository root (produces `.venv/`) | The app starts the bridge with `<repo>/.venv/bin/python -m swufe_bridge.sidecar` by default |
| Platform | macOS or Windows | Linux is out of scope for Phase 1 |
| Network | Reachable `https://webvpn.swufe.edu.cn` | The registrar host `jwxt.swufe.edu.cn` is not directly reachable off campus; WebVPN is required |
| Proxy tooling | **TUN / virtual-interface mode of any other proxy tool must be off** (Clash, mihomo, sing-box, Stash, …) | Measured: TUN fake-ip DNS (`198.18.0.0/15`) makes upstream connections through the bridge hang; `PROXY_CONFLICT` only detects the system proxy, not TUN (see `KI-013`) |
| Account | The tester's own SWUFE unified-identity account (with MFA) | Never written into the repository |

## 2. First-time setup

```bash
uv sync                        # repository root: creates .venv/ (sidecar, WRD codec, CA entry point)
npm install --prefix app       # app/: Electron / TypeScript / esbuild / tsx
```

- If a registry mirror skips package install scripts and `app/node_modules/electron/dist` is missing, run `node app/node_modules/electron/install.js` once.
- Afterwards the daily command is just `npm --prefix app start` (it builds first, then launches).

## 3. Starting

```bash
npm --prefix app start                                        # default userData
npm --prefix app start -- --user-data-dir=/tmp/swufe-dev      # isolated profile
```

- `npm start` = `npm run build && electron .`; everything after `--` is passed to Electron unchanged.
- An isolated profile (`--user-data-dir`) keeps day-to-day configuration clean and is recommended for acceptance and re-runs; it isolates `config.json`, `bridge-config.json`, the `mitmproxy/` CA and the login partition together.
- Environment variables (equivalent overrides, see [app/README.md](../../app/README.md)):

| Variable | Effect |
| -------- | ------ |
| `SWUFE_USER_DATA_DIR` | Equivalent to `--user-data-dir <dir>` |
| `SWUFE_REPO_ROOT` | Overrides the repository root (defaults to the app directory's parent) |
| `SWUFE_PYTHON` | Interpreter for the sidecar / CA entry point (default `<repo>/.venv/bin/python`, falling back to `uv run --project <repo> python`) |
| `SWUFE_PROBE_INTERVAL_MS` | Session-expiry probe interval (default 30000ms; acceptance runs may lower it, e.g. 8000) |

## 4. Operations that need administrator rights

| Operation | Platform behaviour |
| --------- | ------------------ |
| Install the local CA | The UI shows a risk notice first; on confirmation osascript runs `do shell script … with administrator privileges` to execute `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>`. **A system administrator password prompt appears**; cancelling aborts with no writes |
| Uninstall the local CA | Same elevation, running `security delete-certificate -Z <sha1>` |
| Process capture ("selected apps") | On macOS, mitmproxy installs and activates a network extension on first use; the authorization prompt must be **confirmed within 5 seconds**. A timeout fails the attempt and the UI shows guidance plus a "retry" button. Windows requires UAC elevation (see [ADR-0006](../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.md)) |

> On Windows, CA installation writes to the **current-user** Root store (`certutil -user -addstore Root <caCert>`) and shows no administrator password prompt; uninstalling is `certutil -user -delstore Root mitmproxy`.

## 5. Verification and self-check

```bash
npm run acceptance:check -- --out <dir> --user-data-dir <profile>
```

- The script collects one redacted acceptance-evidence report (`<dir>/acceptance-<platform>-<timestamp>.md`): OS/version, key fields of `config.json` and `bridge-config.json`, CA files and trust store, the system-proxy state per network service, whether the bridge port is listening, proxied-versus-direct curl control requests, and leftover sidecar processes.
- The report contains **no** cookie value, no `wrdKey` / `wrdIv` value and no `Set-Cookie` / `Cookie` / `Authorization` header value (NFR-003 / INV-001); the trailing `redaction-self-check` section ends the run with `FAIL` (exit code 1) if anything leaked.
- Switches: `--port` (default 8080), `--host` (default `jwxt.swufe.edu.cn`), `--user-data-dir` (default macOS `~/Library/Application Support/swufe-webvpn-bridge`, Windows `%APPDATA%\swufe-webvpn-bridge`), `--save-body` (off by default; saved bodies may contain personal data and **must not be committed**).
- The full acceptance procedure (including the registrar browser acceptance and result table) is in [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md), section "M4 双平台验收执行手册".

## 6. Common failures

| Symptom | Cause | Action |
| ------- | ----- | ------ |
| Status bar shows "error" with `CA_MISSING` after switching the bridge on | Local CA not installed | Click "install local CA" and enter the administrator password; until then the bridge changes no system setting |
| Bridge start refused with `PROXY_CONFLICT` | Another tool owns the system proxy (Clash / mihomo / sing-box, …) | Turn that tool's system proxy off first; the conflict modal says so, and this app never modifies settings it does not own |
| Bridge start refused with `NOT_LOGGED_IN` | WebVPN (CAS/MFA) login not completed | Click "log in to WebVPN" |
| Bridge start refused with `ALLOWLIST_EMPTY` | Empty allowlist | Add at least one host, or tick `*.swufe.edu.cn` |
| Status bar shows "error" with `BRIDGE_CRASH` | The sidecar exited abnormally, or `bridgePort` is taken | Turn on "debug log" to read the bridge output; if the port is taken, change `settings.bridgePort` in `<userData>/config.json` and retry |
| `swufe-error CONFIG_INVALID` | Invalid runtime config (e.g. a comma inside `capture.processes`) | Fix the corresponding setting in `<userData>/config.json` and switch the bridge on again |
| The sidecar does not start / python not found | The repository root was never `uv sync`ed, or `SWUFE_PYTHON` points at a missing interpreter | Run `uv sync` at the repository root, or fix `SWUFE_PYTHON` |
| The system proxy still points at the bridge after quitting | The previous run ended with `kill -TERM` / `kill -9`, so the JS cleanup never ran (recorded as a known issue) | The next launch clears it via `recoverOnLaunch()` using the "set by this app" marker; manually: `networksetup -setwebproxystate <service> off` (Windows: set `ProxyEnable` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` to 0) |
| The UI reports "process capture: failed" | Network extension not authorized / authorization timed out (macOS) | Allow it under System Settings → General → Login Items & Extensions as the UI explains, then click "retry". A capture failure does not affect the system-proxy path (the bridge stays "running") |

## 7. Windows differences

| Dimension | Windows behaviour |
| --------- | ----------------- |
| System proxy | Read and written through the WinINET registry (`ProxyEnable` / `ProxyServer` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`), leaving every other setting alone |
| When it takes effect | **No `WM_SETTINGCHANGE` broadcast**: already-running browsers may keep using the previous proxy until restarted |
| CA | Written to the current-user Root store (`certutil -user`), no administrator needed; macOS uses the system keychain and needs elevation |
| Process capture | Requires UAC elevation; real scope verification of "selected apps" is deferred with the Windows real-machine items |

> Windows real-machine verification (TC-C02..C04, TC-E01/E02, TC-G03/G04) has not run yet; the reason and the exit conditions are in [verification.md](../../specs/001-phase1-local-bridge/verification.md) ("未验证 / 无法验证项") and in `KI-001` of [known-issues.md](../../specs/001-phase1-local-bridge/known-issues.md).

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
- App-side commands and limits ⇒ [app/README.md](../../app/README.md)
- Bridge control protocol (`swufe-ready` / `swufe-error` / `swufe-debug` / `swufe-capture`) ⇒ [bridge-control-protocol.md](../api/bridge-control-protocol.md)
- Security constraints (cookies, CA private key, permissions) ⇒ [security/README.md](../security/README.md)
- Acceptance procedure and result table ⇒ [specs/001-phase1-local-bridge/verification.md](../../specs/001-phase1-local-bridge/verification.md)
- Test layers and commands ⇒ [testing-strategy.md](../development/testing-strategy.md)
