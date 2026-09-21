# M2: Desktop Orchestration

> Status: Done (implementation complete; the trust-store writes for TC-E01/TC-E02 and the Windows real-machine checks still need a human, see "Remaining issues")
> Owner: cherrchen
> Target: TBD (the original package defines no date) | Completed 2026-09-21
>
> Chinese source of truth: [M2-desktop-orchestration.md](M2-desktop-orchestration.md)

## Goal

Wrap the bridge in the Electron app so the app performs the "log in → start bridge → campus resources usable" orchestration:

- Login WebView + Session Broker: no student ID/password stored, only the cookies the session needs plus minimal ancillary state (REQ-001, REQ-002);
- Proxy Orchestrator: read the OS proxy before starting, refuse to start and ask the user to close Clash / mihomo / sing-box etc. when it is already in use (REQ-004); point the system HTTP/HTTPS proxy at the local bridge when starting; clear it on stop, session expiry or exit only when the "set by this app" flag is present (NFR-004);
- Cert Manager: one-click install/uninstall of the local MITM CA, showing the risk notice on install (REQ-010, NFR-005);
- Session expiry handling: on detecting expiry, stop the bridge → clear the system proxy → stop process capture → prompt re-login.

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | Draft | M1 |

## Exit criteria

- [x] Electron can log in: the WebView completes CAS/MFA and obtains a usable WebVPN session, with no password file (TC-D01, P0) — the login window uses the `persist:swufe-login` partition plus `setProxy({mode:'direct'})`; the stub upstream verifies "open the portal → capture cookies → status becomes logged in"; the real CAS part is listed under "Remaining issues"
- [x] The bridge cannot be started while logged out (TC-D02, P0) — the bridge switch is disabled while logged out and `startBridge` rejects with `NOT_LOGGED_IN` (unit tests cover the precondition order)
- [x] An existing system proxy makes start fail with a clear notice (TC-C01, P0; see [ADR-0004](../../architecture/adr/ADR-0004-refuse-start-when-system-proxy-in-use.md)) — after the real `networksetup` reads `Enabled: Yes / 127.0.0.1:7890` the start is refused and the OS settings are unchanged
- [x] Starting the bridge points the system HTTP/HTTPS proxy at the bridge port (TC-C02, P0) — all six enabled services become `Enabled: Yes / Server: 127.0.0.1 / Port: 8080`
- [x] Stopping the bridge / exiting the app clears the proxy set by this app (TC-C03, TC-C04, P0; NFR-004) — `Enabled: No` after both stop and exit; residue from an unclean exit is cleared by `recoverOnLaunch()` on the next start
- [ ] One-click CA install into the system trust store (TC-E01, P0) and one-click uninstall (TC-E02, P0); a clear failure notice when the CA is missing (TC-E03, P1) — **partially done**: the implementation is complete, the pre-install risk notice was observed (the UI modal precedes any install action) and starting without a CA returns `CA_MISSING` (TC-E03); writing to/removing from the system trust store needs an administrator password, which this machine cannot obtain unattended, so TC-E01/TC-E02 stay unchecked (see "Remaining issues")
- [x] Session expiry triggers stop bridge + clear proxy + stop capture + re-login prompt (TC-D03, P0) — within 8 seconds of observing a 302 to `/login`: system proxy cleared, sidecar exited, modal shown, status bar "expiring", switch forced off
- [x] Affected documents are synced (including bilingual pairs); no blocking defects

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R3 mitm embedding size / signing (medium/medium) | Larger package, signing and distribution friction | Keep mitm external in developer mode first; falling back to a separately installed mitm is acceptable |
| R4 macOS permission prompts scare users off (medium/medium) | Denied accessibility/network-extension permission blocks the process-capture path | UX guidance copy; keep only the system-proxy path if needed |
| R2 Cookie field changes (medium/high) | Session probing misjudges, causing false or missed expiry | Probing signals are centralized (probe-URL marker, session-clearing Set-Cookie, 302 to CAS) plus a manual re-login entry |

## Completion record

**Completion time**: 2026-09-21 (macOS 15.8 arm64 / Node v24.18.0 / Electron 44.4.3 / Python 3.13).

### Deliverables

| Category | Contents |
| ---- | ---- |
| Tooling | `app/package.json` + `app/package-lock.json` (dev: electron 44.4.3, typescript 5.7, tsx, esbuild, @types/node); `app/tsconfig.json` (Main, CommonJS) / `tsconfig.renderer.json` (Renderer, ESM) / `tsconfig.preload.json` (preload type check); `app/scripts/run-unit-tests.mjs` (cross-platform test entry); `app/README.md` |
| Main process | `app/src/main/`: `index.ts` (composition root + single-instance lock + `--user-data-dir`), `windows.ts`, `ipc.ts` (15 contract methods + event broadcasts), `orchestrator.ts` (Proxy Orchestrator), `state-machine.ts`, `session-broker.ts`, `session-probe.ts`, `session-types.ts`, `sidecar.ts`, cert-manager assembly (`platform/index.ts`), `store.ts`, `constants.ts`, `exec.ts`, `python.ts`, `paths.ts`, `shutdown.ts` |
| Platform adapters | `app/src/main/platform/`: `parse.ts` (pure parsers), `ca-files.ts`, `darwin/system-proxy.ts` (`networksetup`), `darwin/cert.ts` (`security` + osascript privilege escalation), `win32/system-proxy.ts` (WinINET registry), `win32/cert.ts` (`certutil -user`), `index.ts` (platform branching + process enumeration) |
| Renderer | `app/src/preload/index.ts` (contextBridge), `app/src/renderer/renderer.ts`, `app/static/index.html`, `app/static/styles.css`, `app/src/shared/{types,global.d.ts}` |
| New Python entry | `swufe_bridge/ca.py` (`python -m swufe_bridge.ca --confdir <dir>`: generate the mitmproxy CA without starting the bridge; reuses CertStore, no home-grown PKI) |
| Tests | `app/test/` (8 unit files + `helpers/fakes.ts`, all electron-free), `app/test/fixtures/portal-stub.mjs` (fake upstream), `app/test/fixtures/stub-ca-app.js` (verification entry with the CA precondition replaced); on the Python side `tests/l1/test_ca.py` and a cross-language config-key case in `tests/l0/test_config.py` |
| CI | [.github/workflows/app-tests.yml](../../../.github/workflows/app-tests.yml): every PR / main push runs `npm ci --prefix app` + `typecheck` + `test:unit` (no Electron binary, no display needed) |

### Verification commands and results (2026-09-21)

| Command | Result | Note |
| ---- | ---- | ---- |
| `uv run pytest tests/l0 -q` | `75 passed` | M1 74 + 1 cross-language config key |
| `uv run pytest tests/l1 -q` | `79 passed` | M1 74 + 5 in `tests/l1/test_ca.py` |
| `uv run pytest tests/l2 -q` | `6 passed` | unchanged from M1 |
| `uv run pytest -q` | `160 passed` | L0+L1+L2 |
| `npm --prefix app run typecheck` | no error | all three tsconfigs (Main / Renderer / preload) |
| `npm --prefix app run test:unit` | `55 passed` | state machine, proxy/cert/process parsers, sidecar control lines, probe classification, AppStore, debug relay, orchestrator |
| `npm --prefix app run build` | passed | `dist/main` (CommonJS) + `dist/renderer` (ESM) + `dist/preload/index.js` (esbuild single-file bundle) |
| `npm run docs:check` | `0 error(s), 0 warning(s)` | links + bilingual pairs + spec structure |
| `npm run typecheck` | no error | root documentation check scripts |

### End-to-end verification (real macOS machine)

**A. The real app (`npm --prefix app start`, `--user-data-dir=/tmp/m2-e2e`, driven over CDP)**

```text
1. Start: status bar "未登录", bridge switch disabled, certificate "未安装", system proxy "未由本 App 设置"
2. Click "安装本机 CA" ⇒ the risk modal appears first (copy: 本证书用于在本机解密并改写 HTTPS，仅限个人设备；可随时卸载。)
   Cancel ⇒ nothing was installed (security find-certificate … | wc -c still 0, UI still "未安装")
3. Click "登录 WebVPN" ⇒ terminal: `swufe-session 登录窗口 resolveProxy(http://127.0.0.1:19080) = DIRECT`
   (the login window bypasses the system proxy; observable evidence for INV-004/EC-005); status "已登录", button becomes
   "重新登录", switch enabled
4. Turn the bridge switch on ⇒ status "错误" + "需要安装本机证书才能处理 HTTPS：请先点击「安装本机 CA」。" (CA_MISSING, TC-E03)
   `networksetup -getwebproxy Wi-Fi` still `Enabled: No` (no OS change at all)
5. Launching a second instance ⇒ exits immediately (0s, exit code 0) while the first keeps running (single-instance lock)
```

**B. Verification entry with the CA precondition replaced (`app/test/fixtures/stub-ca-app.js`; everything else real: real `networksetup`, real sidecar, real IPC/preload/renderer)**

```text
$ node app/test/fixtures/portal-stub.mjs --port 19080 --mode ok &
$ SWUFE_VERIFY_USER_DATA=/tmp/m2-e2e SWUFE_VERIFY_CDP_PORT=9223 SWUFE_PROBE_INTERVAL_MS=2000 \
    app/node_modules/.bin/electron app/test/fixtures/stub-ca-app.js

login ⇒ start bridge:
  swufe-ready {...}                     # sidecar ready (single-line JSON on stderr)
  systems proxy (6 services)            # Ethernet / USB LAN / Thunderbolt Bridge / Wi-Fi / iPhone USB / Stash
  Enabled: Yes / Server: 127.0.0.1 / Port: 8080
  /tmp/m2-e2e/bridge-config.json        # 0600, allowlist + cookies(wrdvpn_session) + debug + webvpnBase

$ curl -sS -i -x http://127.0.0.1:8080 --cacert /tmp/m2-e2e/mitmproxy/mitmproxy-ca-cert.pem https://jwxt.swufe.edu.cn/
  HTTP/2 200; body {"stub":"rewritten","path":"https://jwxt.swufe.edu.cn/","cookie":"wrdvpn_session=STUB-SESSION"}
  (the upstream received the WRD-form path and the injected WebVPN cookie; the `/https/<token>/` value in the body was
  reverse-rewritten back to the real host URL)
  swufe-debug {"host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"request"}
  swufe-debug {"host":"jwxt.swufe.edu.cn","rewritten":true,"direction":"response","detail":"body"}
$ curl -x http://127.0.0.1:8080 … https://example.com/   # not allowlisted
  swufe-debug {"host":"example.com","rewritten":false,"detail":"not-allowlisted"}; 200, not rewritten
  (the same debug event also reaches the renderer over IPC — visible as a renderer console echo in the terminal)

session expiry cascade (curl 'http://127.0.0.1:19080/__mode?expired=1') within 8 seconds:
  swufe-session 会话探测：status=302 location=http://127.0.0.1:19080/login → expired
  swufe-session WebVPN 会话已失效：停止桥接并清除系统代理
  system proxy back to Enabled: No; pgrep -fl swufe_bridge.sidecar prints nothing; modal "WebVPN 会话已失效。桥接已停止并已清除系统代理。" + [去登录]
  status bar "过期处理中", bridge switch forced off; clicking [去登录] and re-logging in returns to "已登录" with the expiry notice cleared

quit cleanup (closing the main window): swufe-quit 开始退出清理（before-quit）→ 退出清理完成
  system proxy Enabled: No; no sidecar process; config.json `systemProxyManagedByApp=false`
  (quitting while the UI is in the `error` state — e.g. `CA_MISSING` — cleans up as well; that path once
  exposed an illegal `error → idle → stopping` transition, now fixed with the regression test
  `app/test/orchestrator.test.ts`)

proxy conflict (TC-C01): first `networksetup -setwebproxy Wi-Fi 127.0.0.1 7890 && -setwebproxystate Wi-Fi on`, then start
  modal "检测到系统代理已启用。请先关闭 Clash / mihomo / 其它 VPN 的系统代理后再试。"
  `networksetup -getwebproxy Wi-Fi` still 7890/on (untouched); no sidecar process; proxy marker still false

unclean-exit self-healing: after `kill -TERM` (proxy residue Enabled: Yes + marker true), restarting gives
  swufe-proxy 检测到上次运行残留的代理标记：清除本桥代理设置 ⇒ proxy back to Enabled: No, marker false
```

> Account/network limits: the real CAS login on `webvpn.swufe.edu.cn` and the academic-affairs acceptance (the real-session part of TC-D01, TC-G01/G02) still need the tester's own account and belong to L3/M4.

### Implementation-time decisions and deviations (record)

| Item | Conclusion and rationale |
| ---- | ---- |
| `verbatimModuleSyntax` in Main | The plan asked for `module: commonjs` + `verbatimModuleSyntax: true`, which TS 5.7 rejects as a combination (TS1287/TS1295). Main uses `isolatedModules: true` instead; the Renderer (`module: esnext`) keeps `verbatimModuleSyntax` |
| preload shape | A `sandbox: true` preload cannot `require` relative paths (measured: `window.swufeBridge` was undefined), so the preload is bundled with esbuild into a single file (new esbuild devDependency + `tsconfig.preload.json` for type checking only, so tsc output and the bundle cannot overwrite each other) |
| IPC surface extension | All 15 contract methods are registered; 3 more were added for the M2 UI: `getSettings` (initial value of the debug switch; the WRD key/IV never cross IPC), `onStatus` (status pushes) and `onSessionExpired` (the expiry modal). Documented in [electron-ipc.md](../../api/electron-ipc.md) and in this record |
| Session cookie payload | Only `name/value/domain/path` are written into `bridge-config.json`; Electron's `secure`/`httpOnly` fields are not sent (the sidecar does not use them); the file is 0600 |
| Session-expiry signal | With `net.request(redirect:'manual')` Chromium reports the redirect target and then cancels the request (`Redirect was cancelled`, measured), so **the redirect event itself is the 3xx response**: classification uses `status + location` (302 → `/login` or → the CAS host means expired; 2xx means valid; anything else / network errors do not change the state). The other two signals (session-clearing Set-Cookie, 302 to CAS after repeated rewrites) are left to M3/M4 |
| Quit cleanup | Only `before-quit`, and it **always `preventDefault()`s**: macOS re-issues a quit when the last window closes, and without holding it the process exits before the async cleanup finishes (residue was observed once). SIGTERM/SIGKILL never run JS (measured), so their residue is healed by `recoverOnLaunch()` |
| Port in use | `bridgePort` is taken from `settings.bridgePort` and never auto-selected; an occupied port fails with `BRIDGE_CRASH` plus an explicit message (port number and what to change) — the error-code set is fixed at 6, messages may differ |
| Process capture and allowlist UI | Per the M2 boundary: `listCaptureCandidates`/`setCapturePids` really enumerate and persist, actual capture belongs to M3, so `localCaptureEnabled` is always `false`; the allowlist is display-only and editing belongs to M3 (T025) |
| `--user-data-dir` | Parsed by the app itself and applied via `app.setPath('userData', …)` (instead of relying on the Chromium switch) so config.json, the cookie partition and the CA confdir are isolated together (both verification runs use it) |
| Platform error handling | An empty macOS network-service list or a failed system-proxy read/write fails with `BRIDGE_CRASH` (never silently skipping the system proxy); when the CA files are missing `getCaStatus` reports "not installed" without generating them implicitly |

### Remaining issues (handed over to M3–M4)

- TC-E01/TC-E02 (writing/removing the system trust store) need an administrator password on the test machine, which was not available in this session: the **manual** execution path of `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain <caCert>` and `security delete-certificate -Z <sha1>` is unverified; the UI risk notice and `CA_MISSING` were measured. Consequently the UI path "start the bridge inside the real app and reach running" requires an installed CA first and was replaced by the verification entry with the CA precondition stubbed.
- The Windows branch (WinINET registry + `certutil`) is implementation + unit tests only; real-machine verification (TC-C02/C03/C04, TC-E01/E02 on Windows) is deferred to M4/T038. Known limitation: no `WM_SETTINGCHANGE` broadcast, so already-running browsers may need a restart to see the proxy.
- Real CAS/MFA login and academic-affairs acceptance (the real-session part of TC-D01, TC-G01/G02) need the tester's own account and an authorized device.
- Q-001's remaining signals (session-clearing `Set-Cookie`, 302 to CAS after repeated rewrites) are not implemented; Q-002 (distribution form) is still open (M4).
- The debug log panel, the process-capture UI/hand-off and the tray icon belong to M3.
