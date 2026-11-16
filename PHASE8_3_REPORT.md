# KernelX Phase 8.3 — Cinematic Landing Page Report

## Scope

Rebuilt the landing route as a six-part, scroll-driven 3D tour into an illustrative supercomputer. The work is confined to the frontend landing page, its Three.js scene, its styles, the landing page tests, and this report. The scene is illustrative and is labeled as not using live simulator data. The existing `/overview` route remains the destination for both entry links. No backend source, scheduling algorithm, DSA implementation, API, or simulation JSON data was changed.

## Design and architecture

- `LandingPage.tsx` owns the sticky full-viewport presentation, skip link, chapter indicators, lazy scene import, and scene fallback.
- `useLandingScroll.ts` maps document scroll to a normalized ref and updates chapter state at section boundaries. It uses a passive listener and `requestAnimationFrame`, and cleans up both on unmount.
- `LandingCpuScene.tsx` composes the machine, package, DSA structures, routes, packet, memory bank, and scene fallback. `LandingStoryOverlay.tsx` holds the explanatory chapter copy and final `/overview` call to action.
- The CPU package is a layered rectangular metallic assembly with edge contacts and four execution units; it is not represented as a ring or platform.
- The machine includes distinct linked-list modules, a tree-shaped max heap, hash buckets with a collision chain, a horizontal FIFO queue with FRONT and REAR markers, and a branching process tree. Transparent glass-like tubes carry inner filaments and the packet route.
- One primary 3D data orb and three lagging trail particles follow a deliberate route controlled by scroll progress. Camera waypoints, execution-unit activation, and memory-block illumination use the same progress, so reverse scrolling reverses the scene.
- The six chapters cover machine entry, process arrival, DSA organization, CPU execution, memory/completion, and the final entry action. A persistent skip link goes directly to `/overview`.

## Accessibility and performance

- The scene is lazy-loaded and has both loading and WebGL error fallbacks.
- `prefers-reduced-motion` disables ambient camera motion, packet motion, and animated execution state; scroll/resize invalidation updates the simplified scene without a continuous render loop.
- The canvas pauses when outside the viewport or when the tab is hidden. It uses a low-power WebGL preference, no antialiasing, a capped pixel ratio, and an instanced mesh for memory blocks.
- A compact camera framing and one-pixel ratio are used on narrow screens. Mobile layout is implemented in CSS but was not visually verified in this run.

## Changes made during final verification

The desktop browser screenshot showed that the KernelX “X” was rendered as a filled teal square. The accent CSS applied a background color to the text span. The rule now colors the “X” text only and keeps the dot backgrounds on their indicator elements. No other code changes were made during this verification pass.

## Verification results

| Check | Result | Evidence |
|---|---|---|
| Backend tests | PASS | `mvn test` in `backend`: 68 tests, 0 failures, 0 errors, 0 skipped. |
| Frontend tests, default command | FAIL on this run | `npm test`: 58 passed, 6 failed across 4 files. The failures were timeouts/async selection assertions while Vitest ran files with its default parallel workers. |
| Frontend tests, serialized rerun | PASS | `npm test -- --maxWorkers=1 --testTimeout=20000`: 64 tests passed across all 15 files. Assertions and test cases were unchanged. |
| TypeScript | PASS | `npm run typecheck` exited successfully. |
| Production build | PASS | `npm run build` succeeded. `LandingCpuScene` is a separate 18.87 kB minified lazy chunk (5.35 kB gzip). Vite still reports the existing Drei `Html` chunk at 881.91 kB minified (232.40 kB gzip), above its 500 kB advisory threshold. |
| Whitespace check | PASS | `git diff --check` exited 0. Git emitted line-ending conversion warnings for modified files. |
| Desktop initial scene | PARTIAL | Chrome at `http://127.0.0.1:5177/`, 1536 × 864: the initial chapter, layered CPU, DSA structures, memory/completion path, header, progress indicator, and scroll cue rendered. The screenshot exposed the header “X” styling defect, which was corrected in CSS after this capture. |
| Scroll sequence / reverse scrolling | NOT VERIFIED | The user pressed Escape during Computer Use. Per the browser-control instructions, no further UI actions were taken. |
| Orb movement / later chapters / final CTA in browser | NOT VERIFIED | The scene code maps packet and camera progress to scrolling, but those states were not captured in this browser run. The CTA link destination is covered by a frontend test. |

## Phase 8.3 dark atmosphere and chapter-transition refinement

The follow-up kept the existing processor, DSA assemblies, conduits, board layout and camera waypoints intact. The scene now uses lower ambient and fill lighting, controlled key and lime light, reduced environment reflection intensity, and ACES filmic tone mapping with lower exposure. This darkens the board while retaining hardware edges and readable labels, without adding post-processing passes. Chapter text cards are mounted together and their opacity, vertical offset and slight scale are calculated from the existing scroll progress in the existing requestAnimationFrame handler. Outgoing text fades and lifts away before the incoming title reaches full opacity; the transition is reversible and the titles do not overlap. Inactive cards are removed from the accessibility tree; stage state continues to determine the interactive card.

### Follow-up verification

| Check | Result | Evidence |
|---|---|---|
| Backend tests | PASS | `mvn test`: 68 tests, 0 failures, 0 errors, 0 skipped. |
| Frontend tests | PASS | `npm test`: 75 tests across 16 files, 0 failures. A first concurrent run during simultaneous Maven/typecheck/build work hit existing async/time-limit failures; the standalone complete rerun passed. |
| Focused landing tests | PASS | `npx vitest run src/components/landing/landingLayout.test.ts src/components/landing/LandingCpuScene.test.tsx`: 13 tests passed. Coverage includes centered copy layout and chapter fade values at boundaries, reversal symmetry and endpoint visibility. |
| TypeScript | PASS | `npm run typecheck` exited 0 after removing an unsupported React `inert` attribute; inactive chapter sections use `aria-hidden` and the CTA has a disabled tab stop. |
| Production build | PASS | `npm run build` succeeded. The existing React Three Fiber bundle advisory remains (about 874 kB minified). |
| Whitespace check | PASS | `git diff --check` exited 0; Git only emitted existing LF-to-CRLF working-copy warnings. |
| Desktop browser review | PASS | Chrome at `http://127.0.0.1:5174/`: inspected the initial chapter, process-creation chapter, finale, and returned to the opening with upward scrolling. The dark graphite board and controlled metallic/lime highlights stayed legible; title copy changed smoothly with scroll and reversed on the return. The existing geometry and component arrangement remained in place. |
| Browser console/network log | NOT VERIFIED | The visual smoke check did not inspect DevTools console or network panels. |
| Reduced-motion runtime | NOT VERIFIED | The reduced-motion path is implemented but was not captured with the OS/browser preference enabled. |
| Mobile layout | NOT VERIFIED | Responsive rules are present; no mobile viewport capture was completed. |
| Browser console/network and measured frame performance | NOT VERIFIED | DevTools console/network and frame-rate measurements were not inspected. No performance claim is made. |

## Test-run note

The default Vitest run failed six checks on timeouts and asynchronous state assertions. It was first run while backend tests and TypeScript verification were also active; a second default-parallel run still had six failures after those jobs had finished. A serialized run with an increased test timeout then passed all 64 tests. This indicates worker contention and timing sensitivity are plausible, but does not conclusively prove the test suite is stable under its default parallel configuration. No assertions were weakened and no tests were removed.

## Remaining limitations and readiness

The landing page build and serialized test suite pass, and the initial desktop frame was inspected. Browser verification is incomplete because the user stopped Computer Use with Escape. In particular, scroll progression and reversal, the later chapter views, final CTA interaction in the browser, reduced-motion runtime, phone layout, console/network status, and measured rendering performance remain unverified. The large Drei `Html` build chunk remains a warning. The page is ready for further review, but the requested full browser acceptance criteria are **partially verified**, not fully verified.

## Internal application redesign follow-up

### Scope and implementation

This follow-up addresses the internal-application redesign brief while keeping the public landing-page implementation out of scope. The internal shell imports `frontend/src/internal-theme.css`, whose design tokens and component rules are all rooted under `.app-frame`. The palette uses near-black graphite (`#0B0D0C`), charcoal surfaces, warm off-white (`#F1F0E8`), selective lime (`#C7F36B`) and restrained amber (`#D6A66A`). Shared shell elements, page headings, panels, controls, forms, tables, feedback states, charts, CPU Internals workbench chrome, workload and experiment surfaces receive the theme. Narrow viewport and reduced-motion overrides are included.

The sidebar KERNELX brand is now an accessible React Router link to `/`, the existing landing route. The simulator Overview destination is `/overview`; other navigation destinations remain routed through the existing shell. Chart palette changes affect presentation only. CPU Internals theme constants were updated without changes to scene geometry, backend snapshots, trace collection or replay logic. No backend source, API contract, persistence format, scheduler, memory algorithm or DSA implementation was changed for this follow-up.

### Files changed for this follow-up

- `frontend/src/layouts/AppShell.tsx`
- `frontend/src/internal-theme.css` (new)
- `frontend/src/pages/Phase42Pages.test.tsx`
- `frontend/src/pages/AnalyticsPage.tsx`
- `frontend/src/pages/OverviewPage.tsx`
- `frontend/src/components/internals/ProcessorDieScene.tsx`
- `README.md`
- `DEVELOPMENT.md`
- `PHASE8_3_REPORT.md`

The test addition covers KERNELX logo navigation to `/` from `/processes` and `/memory`, the existing landing route and its `/overview` entry link. Landing-page source and styling files (`LandingPage.tsx`, `components/landing/**`, `design-system.css`, and `index.html`) were not edited as part of this follow-up. This file-scope observation does not substitute for a visual before/after comparison.

### Verification

| Check | Result | Evidence |
|---|---|---|
| Backend tests | PASS | `mvn test`: 68 tests, 0 failures, 0 errors, 0 skipped. No backend source was changed. |
| Frontend tests | PASS | `npm test`: 77 tests across 16 files passed. Includes the added logo-route coverage. |
| TypeScript | PASS | `npm run typecheck` exited successfully. |
| Production build | PASS | `npm run build` succeeded. The existing large deferred Three.js chunk advisory remains. |
| Internal browser inspection | BLOCKED | Computer Use was stopped by the physical Escape key while selecting the browser window. Per the control instructions, no further browser actions were taken. Consequently internal route appearance, responsive rendering, console/network status, and page-by-page visual checks are not verified in this follow-up. |
| Landing regression, source scope | PASS | Landing page implementation and style files listed above were not edited for this follow-up; internal theme selectors are scoped under `.app-frame`. |
| Landing regression, rendered appearance | NOT VERIFIED | A same-session before/after browser comparison could not be completed after Computer Use was stopped. No claim of pixel-identical rendering is made. |
| Whitespace check | PASS | `git diff --check` from the project root exited 0. Git printed line-ending conversion warnings only. |

### Remaining issues and readiness

Automated frontend/backend checks pass, and the internal brand navigation has test coverage for two internal routes. Browser acceptance remains incomplete because browser control was stopped. In particular, the full set of internal routes, DSA trace panels, responsive breakpoints, browser console/network behavior and rendered landing-page comparison were not inspected. The phase is **partially verified**, not fully accepted, until those browser checks can be completed. No screenshots are attached for this follow-up.
