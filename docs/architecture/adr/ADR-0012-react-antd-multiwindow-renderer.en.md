# ADR-0012: Migrate the renderer to React + Ant Design 6 and turn the desktop UI into a four-window layout

> Chinese source of truth: [ADR-0012-react-antd-multiwindow-renderer.md](ADR-0012-react-antd-multiwindow-renderer.md)

## Status

`Accepted`

> Reviewed and accepted: 2026-09-23 (cherrchen); implementation records live in [specs/002-desktop-ui-multiwindow/](../../../specs/002-desktop-ui-multiwindow/spec.md).

## Date

`2026-09-23`

## Decision Owners

`cherrchen`

## Context

Since M2 the UI (`Telemetry UI`) has been a **bare TypeScript implementation that manipulates the DOM directly**: `apps/desktop/src/renderer/renderer.ts` (~498 lines) plus `apps/desktop/static/index.html` and `static/styles.css`, compiled by `tsc` and loaded from `index.html` via `<script type="module">`; the renderer has no runtime dependency, no component library and no bundler.

After M3 added "capture mode / candidate application list / debug log panel", two kinds of pressure appeared:

- **Window pressure**: the main window (720×640, `minWidth 560` / `minHeight 520`, scrollable) carries status and primary actions, configuration (allowlist, capture mode), long lists (hundreds of candidate application rows, 200 log entries) and diagnostics at the same time. Frequent actions (start the bridge, read status) require scrolling, and the information hierarchy is broken by content length.
- **Maintenance pressure**: renderer state is spread across six module-level variables (`status` / `caStatus` / `settings` / `allowlist` / `candidates` / `logRows`) and converges through `render()` + `renderXxx()` full DOM rewrites plus a manual `refresh()`; adding a control means editing HTML, CSS, event bindings and the render function together, and a missed render cannot be caught by the type system; accessibility attributes are hand-maintained.

Constraints in play:

- The renderer must be **fully offline**: the current CSP is `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:`, so no CDN and no remote fonts/icons ([security/README.md](../../security/README.md) TB-003).
- The renderer is a leaf: it may only call Main through the preload `window.swufeBridge` ([components.md](../../architecture/components.md) single-direction dependency rule); Main owns the authoritative state.
- [dependency-policy.md](../../development/dependency-policy.md) §1 forbids "introducing a second functionally equivalent dependency"; its "introducing a second equivalent approach" and "native build" rows require an ADR (and §2 requires an ADR for infrastructure-level or hard-to-replace dependencies). [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) only decided "Electron instead of a pure CLI" and never constrained the renderer framework, so this is a **core technology-stack change** and an ADR is mandatory per [adr/README.md](README.md).
- Product decisions (2026-09-23): the main window is fixed at 720×560 and **never scrolls**; process-capture application selection, the debug log and allowlist editing each move into a **secondary window**; secondary windows are non-modal and at most one instance per kind.

## Decision

**The renderer is migrated in one pass to React 19 + Ant Design 6, built by Vite (multiple entries); the desktop UI becomes a fixed four-window layout; the bare-DOM renderer is no longer maintained.**

Specific clauses:

1. **Framework and component library**: `react` / `react-dom` 19.3.0 + `antd` 6.6.5 + `@ant-design/icons` 6.3.4 (all MIT). antd 6 over antd 5 because antd 6 supports React 19 natively (no `@ant-design/v5-patch-for-react-19`).
2. **Build**: the renderer is built by `vite` 7.3.6 + `@vitejs/plugin-react` 5.2.0 into multiple entries (`main.html` / `capture.html` / `logs.html` / `allowlist.html` plus a shared chunk, `base: './'`); Main is still compiled by `tsc` and the preload is still bundled by esbuild. No rolldown-based pipeline is introduced (avoids extra native-binary approvals).
3. **Window structure**:
   - the main window has a 720×560 (DIP) baseline, `resizable: false` (the user cannot drag-resize it) and **zero scrolling** (root container `overflow: hidden`, laid out once for that size); the window size adapts proportionally to the **content zoom factor** (`zoomFactor`, default 1.0) clamped to the current display work area — it is deliberately **not** derived from the display `scaleFactor` (on a Retina Mac `scaleFactor = 2` would blow the window up to 1440×1120 DIP, beyond a typical laptop's logical work area);
   - the three secondary windows (capture / logs / allowlist) are **non-modal** and **single-instance per kind** (re-entering an entry point focuses the existing window);
   - long content always lives in a secondary window; when the main window overflows the remedy is "move more content into a secondary window", never "add a scrollbar";
   - closing the main window still quits the app (existing behaviour) and takes the secondary windows with it.
4. **State and data flow**: Main remains the authority (unchanged). IPC events (`onStatus` / `onDebugLog` / `onSessionExpired`) change from "deliver to the main window only" to **broadcast to every live window**; the 200-entry debug-log ring buffer **moves from the renderer into Main** (closing the log window no longer loses history; `setDebugLogging(false)` clears the buffer and closes the log window). The IPC surface only gains four methods (`openCaptureWindow` / `openLogWindow` / `openAllowlistWindow` / `getDebugLogs`); existing methods and events keep their signatures.
5. **CSP**: `style-src` may be relaxed to `'self' 'unsafe-inline'` (antd 6 still injects `<style>` at runtime through `@ant-design/cssinjs`); `default-src 'none'`, `script-src 'self'` and `img-src 'self' data:` are **not** relaxed; all front-end assets ship with the app and no runtime outbound requests are allowed. CSP is injected per mode by a build plugin (strict in production, plus the dev-server origin and HMR WebSocket in development only).
6. **Test stack (exception for a second test runner)**: renderer component tests use `vitest` 3.2.7 + `jsdom` 26.1.0 + `@testing-library/react` 16.3.3 (all dev dependencies, MIT). Reason: the existing `node:test` + `tsx` setup offers neither a DOM environment nor component rendering; `test:ui` and `test:unit` have clear, separate scopes (the former only covers observable UI behaviour, the latter keeps covering electron-free Main-side logic) and no browser runtime is required (CI stays display-less). Assertions that jsdom cannot measure (zero-scroll main window, window count, window-open latency) are verified on the real app via the existing CDP approach.
7. **Cleanup**: once the migration lands, `apps/desktop/static/`, `src/renderer/renderer.ts` and their build paths are deleted; no dual implementation and no feature flag is kept.
8. **In force**: when spec [002-desktop-ui-multiwindow](../../../specs/002-desktop-ui-multiwindow/spec.md) is implemented; accountable owner: cherrchen. This ADR does not change [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) (still Electron, not a pure CLI) nor any bridge-side decision (ADR-0001, ADR-0002, ADR-0004, ADR-0006, ADR-0007, ADR-0011).

## Alternatives

| Alternative | Pros | Cons | Why not adopted |
| ----------- | ---- | ---- | --------------- |
| Do nothing (keep the bare-TS renderer, only adjust the layout) | No new dependency, cheapest migration | Renderer maintenance cost keeps growing; interaction and accessibility stay hand-made; cannot sustain "one screen of content + secondary windows" | The product owner asked for a full migration to React + Ant Design (2026-09-23) |
| Keep antd 5 plus the React 19 patch package | Mature v5 ecosystem | antd 6 already supports React 19 natively; the patch package is one more dependency | The owner switched to antd 6 (2026-09-23) |
| Simulate "secondary windows" with `Modal` / `Drawer` in one window | Simplest to build, no multi-window lifecycle | Not real windows: cannot be moved/resized independently and cannot be used in parallel with the main window (conflicts with "the main window stays usable while picking applications") | The owner explicitly asked for secondary windows (2026-09-23) |
| Single entry plus hash routing | Only one HTML file | Needs hand-written dispatch or a router library (conflicts with "no routing/global state library"), and cannot tailor the initial load per window | Multiple entries match multiple `BrowserWindow`s better and allow per-window code splitting |
| antd 6 `zeroRuntime` static style extraction, keeping `style-src 'self'` | Stricter CSP | One extra style-extraction build step; runtime theme/token adjustments are limited | The owner decided to relax `style-src 'unsafe-inline'` (styles only, script policy unchanged); recorded as a reversible direction |
| Playwright for Electron for UI E2E | Can assert multi-window and zero-scroll automatically | High dependency and CI cost (needs a browser runtime) | This change uses vitest component tests plus the existing CDP real-app assertions instead of pulling a browser runtime into CI for one window layout |

## Consequences

### Positive

- The main window returns to "readable in one screen": status and primary actions are no longer squeezed by long lists, and the hierarchy (status → primary actions → configuration → diagnostics) is stable;
- Interaction and accessibility come from the component library (switch, radio, checkbox list, table, modal, Chinese locale), so a new control is just a component;
- The type system can catch missed-render defects (component props bound to state types); the renderer is no longer "hand-written DOM plus manual refresh";
- With the log buffer in Main, closing and reopening the log window no longer loses history, and the log-minimisation constraint (time/host/result only, no cookies or bodies) is implemented in one place;
- The window registry gives window lifecycle a single home, while the quit path (clearing the system proxy) is unchanged.

### Negative

- The renderer gains its first runtime dependency tree (react / react-dom / antd / icons plus transitive packages), increasing build output and install size;
- `style-src 'unsafe-inline'` is a real relaxation of the security policy (style layer only);
- Renderer processes are created on demand, up to four (main + three secondary), using more memory than a single window;
- A second test runner (vitest) and the jsdom environment are added, taking the repo from one test setup to two (bounded by the scope split above);
- The main window goes from a resizable 720×640 to a 720×560 baseline that cannot be drag-resized (only the content zoom factor changes its size): a user-visible change that must be offset by compact layout;

### Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The fixed small window overflows with Chinese copy (display scaling / larger fonts) | Medium | High | Compact tokens and `componentSize="small"`; assert zero scrolling at 100%/125%/200%; on overflow move content into a secondary window (never add scrolling) |
| antd's runtime style injection is blocked by a strict CSP | Medium | High | Production and development CSP come from the same build plugin; assert styles work and `script-src` stays unrelaxed on the real app |
| A wider IPC broadcast surface makes many windows re-render under full-speed logging | Medium | Medium | Coalesce renders for ~100ms per window; buffer capped at 200 entries; measure on the real app |
| Multi-window lifecycle interferes with "clear the system proxy on quit" | Low | High | Handle `window-all-closed` and the main window `closed` explicitly; `recoverOnLaunch()` still backstops; verify close/quit/expiry paths on the real app |
| Dependency-tree installation and supply-chain risk | Low | Medium | All dependencies are MIT and ship offline; record each one per dependency-policy; review before adding any pnpm `allowBuilds` entry |
| Insufficient UI regression coverage during the migration (001's UI cases must be redone) | High (certain) | Medium | Spec 002 re-runs the UI-related cases and records them; 001 only gains a superseded note and keeps its historical evidence |

## References

- Related requirements: REQ-001, REQ-003, REQ-005, REQ-009, REQ-012 (new: multi-window UI structure), NFR-003, NFR-005, NFR-007
- Related spec: [specs/002-desktop-ui-multiwindow/](../../../specs/002-desktop-ui-multiwindow/spec.md) (design / ui-ux / plan / tasks / verification)
- Related ADRs: [ADR-0003](ADR-0003-electron-gui-for-phase-1.en.md) (Electron shell; unchanged by this ADR), [ADR-0006](ADR-0006-local-capture-mode-and-mutual-exclusion.en.md) (capture modes stay mutually exclusive; only their UI placement changes)
- Related documents: [dependency-policy.md](../../development/dependency-policy.en.md), [testing-strategy.md](../../development/testing-strategy.en.md), [ui-ux/](../../ui-ux/README.md), [api/electron-ipc.md](../../api/electron-ipc.md)
- External references: Ant Design 6 repository and documentation site (`https://ant.design`, version verified with `npm view antd version` on 2026-09-23); Vite (`https://vite.dev`); React 19 (`https://react.dev`); Vitest (`https://vitest.dev`)
