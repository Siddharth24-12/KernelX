# KernelX Phase 8.4 — CPU Internals and Command Deck Report

## Audit findings

The internal layout uses a 252 px fixed sidebar, a sticky 57 px header, and a content area capped at roughly 1,510 px with 40 px desktop gutters. No internal `100vw` sizing rule was found. The concrete excess sizing was concentrated in CPU Internals: `.internals-workspace` and `.processor-stage` each had `min-height: 690px`; `.die-canvas` had `min-height: 580px`; the inspector stretched with the grid and used a 734 px maximum. At widths below 1,120 px, the old rules still imposed 650 px / 550 px minimums, and the mobile inspector imposed 540 px. The first-child/next-sibling tree and other trace panels were not the source of the oversized scene row.

The original die composition had a three-layer broad board, five flat diagnostic modules, and no central processor package. The DSA modules were distributed on the same plane, the interconnects were straight etched blocks, and the scene camera framed a smaller 13.25 × 9.15 board at a fixed 11.2/13.8 camera position. The active browser capture was 1536 × 864; it reported that it could not create a WebGL context, so the prior scene geometry could not be visually assessed in that browser.

Workload Studio already used shrinkable columns and responsive breakpoints; its actual 1536 × 864 capture showed the editor and template library side by side without page-width overflow. Other major page grids use `minmax(0,1fr)` and page-specific breakpoints. Wide process/workload/event data tables intentionally scroll inside their own table wrappers. The global `body` minimum width is 360 px and belongs to a stylesheet also used by the protected landing route, so it was left unchanged.

## Changes

- Rebuilt the CPU Internals board as a 22.5 × 16.5 layered silicon/metal package and arranged the existing PMU, ALU, PDU, FPB and PTU views around a raised central four-core CPU assembly.
- Added thin Catmull-Rom glass-style conduits with metallic conductors, visible connection points and actual trace/focus highlighting. The routes carry no fabricated process values or operations.
- Increased contrast among module substrates, populated structures, core tiles and labels. The existing API snapshots, trace projections, orbit/pan/zoom controls, module focus and reset behavior remain the data and interaction sources.
- Reframed the overview camera for the larger board and moved focus targets with their modules. Geometry is memoized by dimensions; route geometry is memoized from static paths. The Canvas remains lazy, low-power and demand-rendered, with a 1.25 DPR cap and one reduced shadow map.
- Removed forced 690/580 px scene minimums and grid stretching. The processor viewport now uses a bounded viewport-relative height; the inspector sizes to content and bounds its trace history. At narrower desktop widths, the scene and inspector stack. Workload Studio’s editor receives a larger share of the available width.
- Strengthened the internal-only static circuit background while leaving the landing page styles and components untouched.

## Files changed for Phase 8.4

- `frontend/src/components/internals/ProcessorDieScene.tsx`
- `frontend/src/internal-theme.css`
- `PHASE8_4_REPORT.md`

No backend, API, persistence, scheduling, memory, DSA instrumentation, landing component, landing scene, or landing stylesheet was changed for this phase.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Backend tests | PASS | `mvn test`: 68 tests across 33 suites; 0 failures, 0 errors, 0 skipped. |
| Frontend tests | PASS | `npm test`: 78 tests across 16 files passed. |
| TypeScript | PASS | `npm run typecheck` exited 0. |
| Production build | PASS | `npm run build` succeeded. Vite reports the existing React Three Fiber chunk at about 874 kB minified. |
| `git diff --check` | PASS | Root-level check exited 0; Git emitted line-ending conversion warnings. |
| Desktop/browser rendering | PARTIAL | Chrome at `http://127.0.0.1:5174/` was observed at 1536 × 864. The current WebGL message is “This browser or device could not create a WebGL context.” The CPU die geometry and camera interactions cannot be checked in this browser environment. |
| Target desktop sizes 1920 × 1080, 1600 × 900, 1440 × 900 and 1366 × 768 | NOT VERIFIED | The available display capture was 1536 × 864. No target-size captures were obtained. |
| Landing page regression | SOURCE SCOPE PASS / VISUAL NOT VERIFIED | Landing files were not changed. A same-size before/after visual comparison was not possible, and WebGL was unavailable in Chrome. |

## Remaining issues and readiness

The composition and layout fixes are implemented, but visual quality of the new 3D model, camera framing, module overlap, target-size overflow and runtime performance remain unverified because WebGL is unavailable and the browser-control session was stopped with Escape. The earlier Phase 8.3 sidebar and Workload Studio refinements were preserved; their desktop spot-check evidence and limitations are in [PHASE8_3_REPORT.md](PHASE8_3_REPORT.md). Phase 8.4 is **partially verified** until a WebGL-capable browser and the requested desktop viewport captures are available.

## Command deck sidebar update

The sidebar now uses a framed identity module with the same CPU mark, KERNELX wordmark, and SIMULATION WORKSTATION subtitle as the landing header. A compact control-deck identifier sits below it. Navigation retains the existing two groups and settings destination, with numbered rows across all 13 destinations, numbered group labels, an inset graphite channel surface, and a restrained lime active edge/marker. Hover movement is limited to a short horizontal transform and icon tint; the active channel does not rely on continuous animation. A subtle vertical circuit rail ties the navigation sections together. The navigation region scrolls independently; the brand header stays fixed and Settings remains in a bottom-pinned section. The existing collapsed desktop and slide-in mobile behavior is preserved. All changes are scoped to the internal app shell.

### Sidebar update files

- `frontend/src/layouts/AppShell.tsx`
- `frontend/src/internal-theme.css`
- `frontend/src/pages/Phase42Pages.test.tsx`
- `DEVELOPMENT.md`
- `PHASE8_4_REPORT.md`

### Sidebar update verification

| Check | Result | Evidence |
|---|---|---|
| Frontend tests | PASS | Final `npm test`: 78 tests across 16 files passed. The navigation regression asserts all 13 hrefs and all three group labels. An intermediate full-suite run intermittently timed out waiting for the existing brand-to-landing navigation test; that test passed alone and the subsequent full suite passed. No assertion was weakened. |
| TypeScript | PASS | `npm run typecheck` exited 0. |
| Production build | PASS | `npm run build` succeeded; existing React Three Fiber chunk warning remains. |
| Whitespace | PASS | `git diff --check` exited 0; Git emitted line-ending conversion warnings. |
| Browser/sidebar inspection | NOT VERIFIED | The available Computer Use browser session had previously been stopped with Escape, and its instructions prohibit further app input after that stop. No new screenshots or viewport interaction claims are made. |
| Requested viewport sizes and scroll behavior | NOT VERIFIED | 1920×1080, 1600×900, 1366×768, 1280×720, and tablet widths were not captured in this update. |
| Landing page and route preservation | SOURCE SCOPE PASS | Landing files and route definitions were not changed; existing hrefs are asserted in the frontend test suite. Rendered visual regression is not claimed. |

The command-deck sidebar implementation and automated checks are complete. Phase 8.4 remains **partially verified** because visual inspection at desktop/tablet sizes and live scroll/active-state interaction could not be performed through the stopped browser-control session.
