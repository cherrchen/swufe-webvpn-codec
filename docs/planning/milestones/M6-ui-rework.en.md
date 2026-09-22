# M6: UI rework

> Status: Done (2026-09-23)
> Owner: cherrchen
> Target: TBD (the original package defined no calendar dates; this milestone was implemented on 2026-09-23)

## Goal

Migrate the renderer to React 19 + Ant Design 6 (Vite multi-entry build) and fix the desktop UI into a four-window layout:

- the main window is fixed at 720×560, non-resizable and **zero-scroll**: it carries status, primary actions, capture-mode selection, the allowlist summary, CA actions and diagnostics only;
- process-capture application selection, the debug log and allowlist editing each move into a **non-modal secondary window** (single instance per kind);
- the 200-entry debug-log buffer moves into the Electron Main process, so closing and reopening the log window no longer loses history;
- behaviour outside the UI (bridge, sidecar, system proxy, CA, session, rewriting, config persistence) is **unchanged**.

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [002-desktop-ui-multiwindow](../../../specs/002-desktop-ui-multiwindow/spec.md) | Draft | 001 (`Implemented`, provides the UI capabilities and the acceptance baseline), [ADR-0012](../../architecture/adr/ADR-0012-react-antd-multiwindow-renderer.en.md) reviewed and accepted |

## Exit criteria

- [x] every `AC2-001..AC2-013` of spec 002 has `Passed` evidence or a justified `N/A` (recorded in 002's `verification.md`: all 13 `Passed`, with three unverified items listed separately)
- [x] main-window zero-scroll verified at 100% / 125% / 200% scaling (TC-J01: `scrollHeight==clientHeight` and no overflowing element at zoom 1.0/1.25/1.5/2.0; frame 720×560 / 900×700 / 1080×840 / 1440×935)
- [x] non-UI regression green: `test:unit` 85 cases, `test:ui` 36 cases, `typecheck` clean, `build` passing, `uv run --directory bridges/python pytest -q` 198 cases (baseline unchanged)
- [x] macOS real-machine smoke passes: login (stub upstream session) → start bridge → a real browser (Chrome, through the system proxy) reached `http://jwxt.swufe.edu.cn/` and received the rewritten upstream response → stop → quit, all six services `Enabled: No` and no sidecar left behind (TC-J13; the real campus session page check is recorded as unverified)
- [x] the UI-related cases of 001 (TC-H01 / TC-H02 / TC-B05 / TC-F04) re-run on the new UI and recorded (002's verification.md mapping; TC-F04's automated part = the record key set `ts/host/rewritten/direction/detail`)
- [x] affected documents synced (bilingual pairs included: `pnpm run docs:check` 0 error / 0 warning, `pnpm run spec:check` no error)
- [x] no blocking defects; open items = Windows real machine (existing `KI-001`), the real-session campus page check and the real process-capture scope (recorded in 002's `verification.md` under "Unverified / unverifiable")
- [x] window isolation and CSP impact confirmed (all four windows `sandbox: true` + `contextIsolation: true` + no Node integration; only `style-src 'unsafe-inline'` relaxed, TC-J10)

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| The fixed small window overflows with Chinese copy or display scaling (R2-001) | High (the zero-scroll criterion breaks) | Compact tokens and `componentSize="small"`; measure at three scaling levels; on overflow move content into a secondary window instead of adding scrolling |
| antd's runtime style injection conflicts with the CSP (R2-002) | High (all styling lost) | Production and development CSP come from one build plugin; assert styles work and `script-src` stays unrelaxed on the real app |
| Multi-window lifecycle interferes with "clear the system proxy on quit" (R2-004) | High (NFR-004 regression) | Handle `window-all-closed` and the main window `closed` explicitly; `recoverOnLaunch()` backstops; verify all three paths on the real app |
| Insufficient UI regression coverage during the migration (R2-006) | Medium | Re-run 001's UI cases on the new UI and record them; 001 only gains a superseded note and keeps its historical evidence |
| New dependency tree and a second test runner (R2-005 / R2-008) | Medium | Record every dependency per dependency-policy; keep component tests and CDP real-app assertions in separate scopes |

## Completion record

Done (2026-09-23). Spec [002](../../../specs/002-desktop-ui-multiwindow/spec.md) advanced to `Implemented` (T201..T242 in [tasks.md](../../../specs/002-desktop-ui-multiwindow/tasks.md) are all complete); the renderer is the React 19 + Ant Design 6 four-window structure (Vite multi-entry, `dist/renderer/{main,capture,logs,allowlist}.html` plus a shared chunk), the main window is 720×560 and scroll-free, the three secondary windows are single-instance and non-modal, and the 200-entry debug-log ring buffer lives in Main (new `window-registry.ts` / `debug-log-buffer.ts` / `shared/limits.ts`; the old `static/` and `renderer.ts` are deleted).

Evidence and open items:

- Every machine-executable case (TC-J01/J02/J03/J04/J05/J06/J07/J08/J09/J10/J11/J12/J13) passes; the per-case results are recorded in [002's verification.md](../../../specs/002-desktop-ui-multiwindow/verification.md) (command output, measured window sizes, CSP and isolation checks).
- Unverified: the Windows real machine (existing `KI-001`), the campus page under a real CAS/MFA session (this milestone verified the same path with a stub upstream + stub session + a real browser) and the real process-capture scope after the system-extension authorisation (needs an admin password and a manual approval).
- Behaviour outside the UI is unchanged: `capture.processes` stays empty in system-proxy mode, quitting still clears the system proxy (all six services `Enabled: No`), and the Python suite (198) plus the app unit tests (85) match the pre-migration baseline.
