# KernelX Phase 8.1 — Landing Page Animation Rebuild

## Changes

- Replaced the scroll-story landing page with one viewport-based entry screen. The header carries KernelX branding; the left column contains the introduction and the `Enter KernelX` link; the right column contains the process pipeline and state key. The action links directly to `/overview`.
- Removed the vertically stacked story stages, scroll-triggered stage changes, Explore link, scroll prompt, and landing footer/stat line. At an 800 px browser width, the content stacks and remains visible together in the captured viewport; desktop widths retain the two-column layout.
- Reworked the 3D pipeline framing for wide, desktop and narrow canvas proportions. The scene identifies input, scheduler, CPU/execution cores, memory and completion. Six packets loop through the circuit path. They pause at the scheduler portion, shift from waiting white to ready mint to running amber and subdued completion mint, and the execution cores illuminate during the running segment.
- Kept the scene lazy-loaded. `prefers-reduced-motion` freezes the camera, core activity and packets in a useful distributed pipeline layout. A labeled CSS pipeline is available when WebGL fails.
- Updated shared design tokens and shared controls to graphite (`#101820`), elevated graphite surfaces (`#17232D`, `#202C38`), off-white (`#E9EEF5`), muted text (`#A5B3C2`), mint (`#55D6BE`) and restrained amber (`#F4BD62`). Buttons use translucent blurred surfaces, rounded edges, controlled borders/shadows and visible keyboard focus styling.
- Updated the landing route test to assert the single-screen structure, absence of scroll-story copy, and `/overview` destination. Updated README and DEVELOPMENT notes.

### Why the previous motion was inadequate

The prior loop advanced only `0.035` of its path per second, so a packet needed about 29 seconds to complete a circuit. The board was framed too small in wide canvas layouts, and CPU-core illumination ran on an unrelated timer. The new loop advances at `0.07` per second (about 14 seconds per cycle), pauses at the scheduler, uses state changes along the path, syncs core illumination to the running interval, and adjusts camera framing to canvas aspect ratio.

## Verification

Commands were run from the listed directories:

| Command | Result |
| --- | --- |
| `cd backend; mvn test` | **PASS** — 68 tests, 0 failures, 0 errors, 0 skipped. |
| `cd frontend; npm test` | **PASS** — 61 tests across 14 files. |
| `cd frontend; npm run typecheck` | **PASS**. |
| `cd frontend; npm run build` | **PASS** — Vite production build completed. |
| `git diff --check` | **PASS**. |

One earlier frontend run was started while Maven was consuming resources and had 13 timeout/fetch failures. The frontend suite passed on rerun without that concurrent test load and passed again after the final scene changes. No assertions were removed or relaxed.

The production output keeps the landing route and scene in lazy chunks (`LandingPage` 3.72 kB; `LandingCpuScene` 8.54 kB). Vite still reports the deferred Three.js/Drei `Html` dependency chunk at **881.90 kB uncompressed / 232.40 kB gzip**, above its advisory threshold. The scene remains lazy-loaded; further chunk reduction was not attempted because it risks the 3D implementation and was not needed for the initial route split.

## Browser evidence and limits

| Check | Status | Evidence |
| --- | --- | --- |
| Landing route renders in Chrome | **PASS** | Opened `http://localhost:5175/`. The 3D board and labeled pipeline were visible. |
| Named lifecycle areas and multiple packet markers | **PASS** | Browser screenshot and accessibility text showed process input, scheduler, CPU/execution, memory, completed output, and the four packet-state labels. |
| Tablet-width responsive composition | **PASS** | At the observed 800 px window width, content stacked into one viewport composition and the scene/legend remained visible. |
| CTA destination | **PASS** | Clicked `Enter KernelX`; Chrome navigated to `/overview`, which rendered the simulator shell and showed API connected. |
| Continuous motion compared across controlled browser captures | **NOT VERIFIED** | The scene rendered in WebGL; no stable pair of same-size, time-separated captures was retained after the final camera changes. Code uses the render loop for packet movement and linked core illumination. |
| Phone-width layout below 420 px | **NOT VERIFIED** | CSS has dedicated narrow-screen rules, but a phone-sized browser viewport was not captured. |
| Reduced-motion preference in browser | **NOT VERIFIED** | The preference listener and frozen static packet/camera behavior are implemented; OS/browser preference was not toggled during browser review. |
| Button hover/focus states and browser console | **NOT VERIFIED** | Styles define hover, pressed, disabled and keyboard-focus feedback. These states and the developer console were not inspected in Chrome. |
| Other simulator pages after shared styling | **PARTIAL** | Overview was opened after the CTA. Other routes were not individually reviewed in the browser; automated tests passed. |

Browser interaction was interrupted when the active window changed to Codex, so no additional browser actions were taken. No screenshot image files were exported from the browser session.

## Files changed for Phase 8.1

- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/components/landing/LandingCpuScene.tsx`
- `frontend/src/design-system.css`
- `frontend/src/pages/Phase42Pages.test.tsx`
- `README.md`
- `DEVELOPMENT.md`
- `PHASE8_1_REPORT.md`

No backend logic or JSON simulation data was changed.

## Remaining work

The single-screen landing page and its direct `/overview` entry are implemented and tested. Phone viewport, reduced-motion preference, button hover/focus, browser console and sustained packet motion still need a deliberate browser review before claiming full visual verification. The Three.js/Drei chunk advisory also remains.
