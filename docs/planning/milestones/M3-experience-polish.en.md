# M3: Experience Polish

> Status: Done
> Owner: cherrchen
> Target: TBD (the original package defines no date)
>
> Chinese source of truth: [M3-experience-polish.md](M3-experience-polish.md)

## Goal

Finish the controllable items that sit beside the main path but still belong to Phase 1, so users can manage the routing scope themselves, see what happened, and narrow capture per process:

- Allowlist UI: `jwxt.swufe.edu.cn` by default, hosts can be added/removed and persisted, optional `*.swufe.edu.cn` wildcard (REQ-005);
- Debug logging toggle and log panel: records only "domain + whether rewriting succeeded", off by default, never bodies or cookies (REQ-009, NFR-003);
- Process capture: list candidate processes and capture the selected ones only (REQ-003);
- Status area and Chinese copy: consistent with the bridge state machine; CA install risk notice, proxy conflict notice, session expiry notice (REQ-001, NFR-005).

## Included specs

| Spec | Status | Dependencies |
| ---- | ------ | ------------ |
| [001-phase1-local-bridge](../../../specs/001-phase1-local-bridge/spec.md) | In Progress | M2 |

## Exit criteria

- [x] Allowlist hosts can be added and removed and persist across an app restart (TC-B05, P1)
- [x] The `*.swufe.edu.cn` wildcard checkbox and its explanatory copy work (TC-H02, P2)
- [x] Debug logging works and carries no bodies: the panel shows only time/host/result and never bodies or cookies (TC-F04, P1; NFR-003; panel behaviour verified on real hardware, the live bridge link is in the remaining issues)
- [ ] Process capture works: candidate apps (one row per app) can be selected and capture applies only to them (TC-G04, P1) — **partially done**: the capture-mode UI, candidate merging, selection and mode persistence, the exclusion with the system proxy, refusal while another tool owns the system proxy, the failure guidance with retry, and the sidecar's mode-set apply/remove/rollback and `swufe-capture` reporting are all verified (real hardware plus L0/L1/app unit tests); "applies only to them" needs the tester to confirm the macOS system-extension prompt in person, and starting the bridge needs an installed CA (admin password) plus a real WebVPN login, so it stays unchecked (see the remaining issues)
- [x] Status display matches the bridge state machine, capture state included (TC-H01, P1)
- [x] Key copy is in place: CA install risk notice, proxy conflict notice (close Clash / mihomo etc.), session expiry notice, plus the capture-mode hint and the process-capture authorisation guidance (NFR-005)
- [x] Affected documents are synced (bilingual pairs included, `pnpm run docs:check` 0 error/0 warning); no blocking defects

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| R4 macOS permission prompts scare users off (medium/medium) | The accessibility/network-extension permission process capture needs gets denied; poor UI guidance blocks that path | Guide the permission steps in copy; failure of this path does not break the main system-proxy path |
| R1 Academic-affairs front end has many dynamic absolute URLs (medium/high) | Missed rewrites are only found in live testing and are hard to locate without logs | Use debug logging per domain to check rewrite results as the localization tool for response rewriting |

## Completion record

- **Completed**: 2026-09-21
- **Deliverables**
  - **Capture mode (first level) and process capture**: the capture-mode section in `apps/desktop/static/index.html` (system proxy / selected apps + capture state + app list + macOS authorisation guidance + retry); `apps/desktop/src/renderer/renderer.ts` (`renderCapture`, `applyCaptureMode`, failure state, filtering); `apps/desktop/src/shared/types.ts` (`CaptureMode` / `CaptureCandidate.pattern` / `CaptureReport` / `BridgeStatus.captureError`); `apps/desktop/src/main/{store,orchestrator,ipc,sidecar,constants}.ts` (persisting and validating `captureMode` / `captureProcesses`, the mutual exclusion with revoke/restore of the system proxy, `swufe-capture` parsing and status reporting); `apps/desktop/src/main/platform/parse.ts` (`capturePattern` / `captureName` / `groupCaptureCandidates`, one row per application); `bridges/python/swufe_bridge/capture.py` (mode-set derivation, rollback on failure, no retry for the same config) + `bridges/python/swufe_bridge/addon.py` (capture loop and `swufe-capture` reporting) + `bridges/python/swufe_bridge/sidecar.py` (`--mode regular@<port>`) + `bridges/python/swufe_bridge/config.py` (`capture.processes` and `ConfigWatcher.stamp`).
  - **Editable allowlist**: add host / per-row delete / `*.swufe.edu.cn` tick, effective immediately and preserved across restarts.
  - **Log panel**: columns `time | host | result`, at most 200 records, newest first, clear button, hidden by default and driven by the debug-log switch.
  - **Copy and status**: capture-mode hint (including that switching revokes the system proxy), process-capture authorisation guidance, "failed — <reason>" with a retry button; the status bar gains "Bridging (process capture)".
  - **Documentation**: requirements / UI-UX / architecture (components, interfaces, data flow, data model) / API (Electron IPC, bridge control protocol) / ADR-0006 (new, both languages) / spec 001 (spec, design, plan, tasks) / testing-strategy / roadmap / this milestone (bilingual pairs).
- **Verification evidence** (full commands and observations in [verification.md](../../../specs/001-phase1-local-bridge/verification.md))
  - `uv run --directory bridges/python pytest -q` → `190 passed` (L0 97 / L1 86 / L2 7; M3 added 14 cases in `bridges/python/tests/l0/test_capture.py`, 7 in `bridges/python/tests/l1/test_addon_capture.py`, 7 config capture cases and 2 L2 capture cases).
  - `pnpm --filter swufe-webvpn-bridge run typecheck` clean; `pnpm --filter swufe-webvpn-bridge run test:unit` → `70 passed`; `pnpm --filter swufe-webvpn-bridge run build` passes.
  - `pnpm run docs:check` → `0 error(s), 0 warning(s)` (148 files); `pnpm run typecheck` clean.
  - macOS real hardware (real app driven over CDP, `--user-data-dir=/tmp/m3-e2e`): allowlist add/remove, invalid-host message, wildcard tick; 363 candidate rows with Chrome's main process and helpers merged onto one pattern; selection and capture mode preserved across a restart; log panel with three columns, the 200-record cap, clearing and switch-driven visibility; capture state and failure guidance (with retry); switching to selected apps while another tool owns the system proxy shows the conflict modal and persists nothing; after quitting there is no sidecar process left and the system proxy is still `Enabled: No`.
- **Decisions and deviations made while implementing** (all documented; not relitigated here)
  1. Process capture uses mitmproxy `local` mode instead of a self-built network extension, and is **mutually exclusive** with the system proxy (new [ADR-0006](../../architecture/adr/ADR-0006-local-capture-mode-and-mutual-exclusion.en.md)).
  2. The sidecar now starts as `--mode regular@<port>` and no longer passes `--listen-port` (a global listen_port would make the runtime `local:` mode collide with `regular`).
  3. Capture is an optional capability that takes effect asynchronously at runtime: the addon polls the config once per second, does not retry after a failure, and a failure never changes the bridge state (only `captureError`).
  4. **Deviation (interface detail)**: the plan had the renderer key off `error.code`, but Electron 44's `invoke` rejection keeps **only `message` and `stack`** (custom properties are dropped — verified with a minimal Electron probe), so `setCaptureMode` / `setCaptureProcesses` now reject with `<CODE>：<message>` and the renderer parses that prefix to decide whether to show the conflict modal. Documented in [electron-ipc.en.md](../../api/electron-ipc.en.md) § error model.
  5. **Deviation (implementation detail)**: `capturePattern` uses the **non-greedy** regex `^(.*?\.app)/Contents/` (the plan text wrote the greedy variant); greedy would fold Chrome's helper onto `…/Google Chrome Helper.app/` instead of the outer `Google Chrome.app/`, contradicting "main process and helpers merge into one row". Pinned by `apps/desktop/test/system-proxy-parse.test.ts`.
  6. **Deviation (UI ordering)**: on a failed capture-mode switch the saved mode is re-displayed *before* the conflict modal opens (the plan only required a final refresh; in practice, awaiting the modal first left the radio showing the unsaved mode while the modal was open).
- **Remaining issues**
  - Verifying the real capture **scope** ("only the chosen apps go through the bridge, the others do not") needs the tester to confirm the macOS system-extension prompt in person, and starting the bridge needs an installed CA (admin password) plus a real WebVPN login; this session only verified everything up to that authorisation plus the failure guidance.
  - The log panel working against the real bridge (records appearing as traffic flows) likewise needs an installed CA and a login, and was not executed here.
  - The 5-second authorisation window behind the failure copy was not measured under a real authorisation prompt.
  - Windows real-hardware items and the academic-affairs browser acceptance remain M4 (T038 / TC-G01).

