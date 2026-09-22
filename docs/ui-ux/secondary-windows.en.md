# Secondary Windows

> Status: Draft ｜ Owner: cherrchen ｜ Last Reviewed: 2026-09-23
>
> Chinese source of truth: [secondary-windows.md](secondary-windows.md)

## Goal

- User goal: move the three kinds of **long content** (capture app picker, debug log, allowlist editing) out of the main window so that the main window fits every high-frequency item into its fixed small size without scrolling, while the main window stays usable when a secondary window is open.
- Related requirements: REQ-003 (traffic takeover and capture candidates), REQ-005 (allowlist routing), REQ-009 (observability and the debug log), REQ-012 (multi-window structure), NFR-003, NFR-007.
- Related spec: [specs/002-desktop-ui-multiwindow/](../../specs/002-desktop-ui-multiwindow/spec.md); the main window is documented in [main-window.en.md](main-window.en.md).

## Shared conventions

| Item | Convention |
| ---- | ---------- |
| Modality | **Non-modal**: no parent window is set and the main window is not blocked; the user can interact with the main window and the secondary window at the same time |
| Instances | At most one per kind: repeating an entry (e.g. [Pick apps…] again) only focuses and raises the existing window instead of opening another |
| Lifecycle | Opened from the main window's [Pick apps…] / debug-log switch / [Manage…]; closing the main window quits the app and the secondary windows go with the process; closing one secondary window only destroys that window and changes no persisted state |
| State source | Electron Main stays the source of truth: a window fetches its initial state on mount and afterwards only follows Main's broadcast events (status, log, session expiry) plus the results of its own operations |
| Isolation | Same isolation level as the main window: `contextIsolation: true` + `sandbox: true` + no Node integration, sharing the same preload |
| Scrolling | Only the list/table region inside a window scrolls; the document never scrolls |
| Copy | Chinese-first (Ant Design `zh_CN` locale) |

## Capture window

Size 560×480 (resizable, minimum = default). Entry: [Pick apps…] in the main window.

```text
┌───────────────────────────────────────────────────────┐
│ 进程捕获：已启用（2 个应用）                          │  same four state lines as the main window
│ 当前捕获方式：指定应用                                │  system proxy: 当前捕获方式为系统代理，进程捕获未启用。
│ 系统代理：全部流量经本桥；指定应用：只有所选应用的流  │  permanent explanation line (how the two modes relate)
│ 量经本桥，本 App 不设置系统代理（切换时会撤销本 App   │
│ 设置过的系统代理）。                                  │
├───────────────────────────────────────────────────────┤
│ [筛选应用名…]                          [ 刷新列表 ]   │
├───────────────────────────────────────────────────────┤
│ ☑ Google Chrome          (selected rows come first)   │
│ ☐ curl                                                │  one row per app (main process and helpers merged)
│ ☐ Safari                                              │
│ … (the list scrolls internally)                       │
├───────────────────────────────────────────────────────┤
│ 已选 1 / 32                                           │  selection cap 32 (mirrors Main's validation)
└───────────────────────────────────────────────────────┘
```

Failure state (only when process capture failed; replaces the area below the state line):

```text
│ 进程捕获：启用失败 — <原因>
│ 首次启用时 macOS 会安装并激活 mitmproxy 的网络扩展：请在系统
│ 设置 → 通用 → 登录项与扩展（或弹出的授权提示）中允许。未在 5 秒内
│ 确认会导致启用失败，授权后点「重试」。          [ 重试 ]
```

| Item | Convention |
| ---- | ---------- |
| List contents | Selected patterns always stay in the list (first, in saved order), followed by unselected candidates matching the filter; a pattern with no candidate is shown as `<pattern>（当前未运行）` |
| Ticking / unticking | Pushed and persisted immediately (`setCaptureProcesses` overwrites the whole selection), with no bridge restart and no re-open; on failure the reason is shown and the UI rolls back to Main's current value |
| Filter | Matches the app name (case-insensitive) against unselected candidates; selected rows are unaffected by the filter (otherwise they could not be unticked) |
| [Refresh list] | Re-enumerates the candidates; a failure or an empty result shows the empty state |
| Empty states | No candidates: `暂无候选应用：请点「刷新列表」重试。`; no filter match: `没有匹配的应用。` |
| Edge cases | Opening is allowed while logged out (the selection is saved but takes no effect; starting the bridge is still governed by `NOT_LOGGED_IN`); after switching back to system proxy the window stays open showing `当前捕获方式为系统代理，进程捕获未启用` and the ticks remain viewable/editable (persisted, not in effect) |
| Cap | The selection stays ≤ 32; beyond that Main refuses and returns an error (the renderer does not make business decisions) |

## Log window

Size 720×420 (resizable, minimum = default). Entry: it opens automatically when the main window's debug-log switch is turned on, and closes (with the buffer cleared) when the switch is turned off.

```text
┌───────────────────────────────────────────────────────────────┐
│ 调试日志        最近 200 条，最新在前（当前 3 条）  [ 清空 ]  │
├───────────────────────────────────────────────────────────────┤
│ 时间        │ 域名                      │ 结果                 │
├─────────────┼───────────────────────────┼──────────────────────┤
│ 12:01:03    │ jwxt.swufe.edu.cn         │ 已改写               │
│ 12:01:03    │ example.com               │ 直连                 │
│ … (the table scrolls internally)                              │
└───────────────────────────────────────────────────────────────┘
```

| Item | Convention |
| ---- | ---------- |
| Record keys | Fixed to `ts` / `host` / `rewritten` / `direction` / `detail`; never request/response bodies or cookies (NFR-003) |
| Result column | `已改写` (request direction, rewritten) / `响应改写` (response direction, rewritten) / `直连` (not rewritten); `detail` is appended as `（<detail>）` when present |
| Order and capacity | Newest first; at most 200 records, the oldest is dropped beyond that (the buffer lives in Main, the renderer only displays it) |
| History restore | Reopening the window while the switch is still on restores the recent records from Main's ring buffer — closing the window never loses history |
| [Clear] | Empties Main's ring buffer and the list (a reopened window stays empty afterwards) |
| Empty state | `尚无日志：开启调试日志并产生流量后在此显示。` |
| Render throttling | Records are rendered in merged batches (100ms normally; 250ms when the window already holds 200 rows and the arrival rate exceeds 50 records/second) so full-speed traffic cannot block interaction |
| Edge cases | Debug logging is off by default; the buffer is memory-only and never written to disk |

## Allowlist window

Size 480×400 (resizable, minimum = default). Entry: [Manage…] in the main window (the main window only keeps a summary).

```text
┌───────────────────────────────────────────────────────┐
│ Allowlist                                             │
├───────────────────────────────────────────────────────┤
│ [ 输入主机名，如 portal.swufe.edu.cn ]   [ 添加 ]     │
│ 已添加 portal.swufe.edu.cn。                          │  success/failure note (invalid input: inline error, nothing written)
├───────────────────────────────────────────────────────┤
│ jwxt.swufe.edu.cn                              [ 删除 ]│
│ portal.swufe.edu.cn                            [ 删除 ]│
│ … (the list scrolls internally)                       │
├───────────────────────────────────────────────────────┤
│ ☐ 启用 *.swufe.edu.cn（含 apex swufe.edu.cn）         │
└───────────────────────────────────────────────────────┘
```

| Item | Convention |
| ---- | ---------- |
| Adding | Only non-empty, structurally valid input (labels of letters/digits/`-`, at least two labels) is submitted; on success the input is cleared and `已添加 <host>。` is shown, and the main-window summary follows |
| Validation | Empty input → `请输入主机名。`; structurally invalid → `主机名不合法：<输入>`; both only show an inline note and write **nothing**. Final validation still happens in Main (case folding, trailing-dot stripping, illegal characters, length); Main's rejection reason is shown in the same inline slot |
| Removing | Each row's [Delete] (`aria-label` is `删除 <host>`) saves the remaining hosts and shows `已删除 <host>。` |
| Wildcard | `启用 *.swufe.edu.cn（含 apex swufe.edu.cn）` is saved as soon as it is toggled; off by default |
| Defaults | `{"hosts":["jwxt.swufe.edu.cn"],"includeSwufeWildcard":false}`; the hard-coded exclusions of `webvpn.swufe.edu.cn` / `authserver.swufe.edu.cn` are unaffected by the UI change |
| Persistence | Adding, removing and the wildcard take effect immediately (written to `<userData>/config.json`) and survive a restart |
| Empty state | With no hosts: `（空：所有流量直连）`; starting the bridge requires at least one host or the wildcard, otherwise error code `ALLOWLIST_EMPTY` |

## Accessibility

- Keyboard: every interactive control can be focused with Tab and operated (checkboxes, inputs and buttons are Ant Design controls with keyboard semantics).
- State expression: counters, state lines and errors are all textual (e.g. `启用失败 — <原因>`, `已选 1 / 32`), never colour-only.
- Window titles: `进程捕获 — 应用选择` / `调试日志` / `Allowlist`, which is how users tell windows apart in a multi-window environment.
- Copy and localisation: all Chinese (NFR-007); light theme by default.

## Copy

| Location | Copy | Notes |
| -------- | ---- | ----- |
| Capture window mode line | `当前捕获方式：指定应用` / `当前捕获方式为系统代理，进程捕获未启用。` | EC2-005 |
| Capture-mode explanation | `系统代理：全部流量经本桥；指定应用：只有所选应用的流量经本桥，本 App 不设置系统代理（切换时会撤销本 App 设置过的系统代理）。` | permanent line; moved here from the main window in 002 |
| Capture window toolbar | filter placeholder `筛选应用名…`, `刷新列表`, `重试` | |
| Capture window counter | `已选 N / 32` | cap 32 |
| Capture window empty states | `暂无候选应用：请点「刷新列表」重试。` / `没有匹配的应用。` | |
| Selected but not running | `<pattern>（当前未运行）` | when the pattern has no candidate |
| Log window header | `调试日志`, `最近 200 条，最新在前（当前 N 条）`, `清空` | |
| Log window empty state | `尚无日志：开启调试日志并产生流量后在此显示。` | |
| Log result column | `已改写` / `响应改写` / `直连` (with `（<detail>）` when `detail` is present) | NFR-003 |
| Allowlist window | input placeholder `输入主机名，如 portal.swufe.edu.cn`, `添加`, `删除`, `启用 *.swufe.edu.cn（含 apex swufe.edu.cn）` | |
| Allowlist notices | `已添加 <host>。` / `已删除 <host>。` / `主机名不合法：<输入>` / `请输入主机名。` | invalid input is reported, never written |
| Window load failure | `界面加载失败：<原因>。可点「重新加载窗口」重试。` + `重新加载窗口` | shown instead of a blank window when a window's components throw |

> The strings above are Chinese UI copy and are kept verbatim from the implementation (the Chinese file is the source of truth).

## Open questions

| ID | Question | Status |
| -- | -------- | ------ |
| Q1 | Windows-side size/font differences (list row height under CJK fonts)? | TBD (carries over the `KI-001` deferral from 001) |
| Q2 | Should secondary-window position and size be remembered across restarts? | TBD (window geometry is not persisted today) |
| Q3 | Does the log window need an "export" once it holds 200 rows? | TBD (only [Clear] today; export touches privacy boundaries and needs a security review first) |
