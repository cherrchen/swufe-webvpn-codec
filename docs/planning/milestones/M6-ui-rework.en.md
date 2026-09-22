# M6: UI rework

> Status: Planned
> Owner: cherrchen
> Target: TBD (not scheduled yet; no earlier than the M4 open items — the Windows real-machine items and the real process-capture scope — converge)

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

- [ ] every `AC2-001..AC2-013` of spec 002 has `Passed` evidence or a justified `N/A` (recorded in 002's `verification.md`)
- [ ] main-window zero-scroll verified at 100% / 125% / 200% display scaling (TC-J01)
- [ ] non-UI regression green: `test:unit`, `test:ui`, `typecheck`, `build`, `uv run --directory bridges/python pytest -q`
- [ ] macOS real-machine smoke passes: login → start bridge → browse an allowlist host → stop/quit with no residual system proxy (TC-J13)
- [ ] the UI-related cases of 001 (TC-H01 / TC-H02 / TC-B05 / TC-F04) re-run on the new UI and are recorded
- [ ] affected documents are synced (including bilingual pairs: `pnpm run docs:check` 0 error, `pnpm run spec:check` no error)
- [ ] no blocking defects; open items recorded in 002's `known-issues.md` or the existing `KI-*` list
- [ ] window isolation and CSP impact confirmed (`sandbox: true` + `contextIsolation: true`; only `style-src` relaxed, TC-J10)

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| The fixed small window overflows with Chinese copy or display scaling (R2-001) | High (the zero-scroll criterion breaks) | Compact tokens and `componentSize="small"`; measure at three scaling levels; on overflow move content into a secondary window instead of adding scrolling |
| antd's runtime style injection conflicts with the CSP (R2-002) | High (all styling lost) | Production and development CSP come from one build plugin; assert styles work and `script-src` stays unrelaxed on the real app |
| Multi-window lifecycle interferes with "clear the system proxy on quit" (R2-004) | High (NFR-004 regression) | Handle `window-all-closed` and the main window `closed` explicitly; `recoverOnLaunch()` backstops; verify all three paths on the real app |
| Insufficient UI regression coverage during the migration (R2-006) | Medium | Re-run 001's UI cases on the new UI and record them; 001 only gains a superseded note and keeps its historical evidence |
| New dependency tree and a second test runner (R2-005 / R2-008) | Medium | Record every dependency per dependency-policy; keep component tests and CDP real-app assertions in separate scopes |

## Completion record

Not done yet. Progress and evidence live in [002's tasks.md](../../../specs/002-desktop-ui-multiwindow/tasks.md) and [verification.md](../../../specs/002-desktop-ui-multiwindow/verification.md).
