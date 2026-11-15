# KernelX Phase 7C — Final Stability and Submission Readiness

Date: 2026-11-15

## Readiness summary

**Status: PARTIALLY READY.** The backend suite and three consecutive frontend suite runs pass. The frontend test cleanup now resets spies, mock implementations, timers, and browser storage. PMU middle-node deletion replay has direct projection coverage. CORS works for the requested local origins and rejects unrelated origins. Populated browser replay checks remain incomplete as documented in Phase 7B; this phase did not use browser automation and does not claim browser verification.

## Investigations and findings

### Frontend test instability

Phase 7B's first full frontend run had 5 failures among 55 tests: several lazy-route tests timed out at five seconds and one navigation assertion did not find its heading. An immediate rerun passed, so the cause of those particular timeouts was not established.

The shared test setup only unmounted React trees. Inspection found test environment state that was not consistently reset:

- `vi.spyOn(window, 'confirm')` was used in multiple suites, while `vi.clearAllMocks()` only clears call history and does not restore spies.
- One-shot mock implementations could remain queued if a preceding test ended before consuming them.
- Fake timers and browser storage were not covered by common cleanup.
- CPU Internals API defaults were declared in module mock factories; resetting all mocks required reinitializing those defaults in each test's `beforeEach`.

The application polling intervals are registered by effects and cleared on unmount. Trace-loading effects use cancellation flags to ignore responses from a trace selection that has since changed. No fake-timer usage existed in the prior test suite. The reported Phase 7B failures were not reproduced in this phase's three consecutive runs; the specific historical timeout cause remains unproven.

**Changes:** shared teardown now performs React cleanup, restores spies, resets mock implementations, returns to real timers, and clears local/session storage. The CPU Internals test explicitly seeds its API mock defaults before every test. A setup-isolation test verifies that spies, fake timers, storage, and queued mock behavior do not carry into the following test.

### DSA deletion replay

Backend source and `PmuApiIntegrationTest` confirm that deleting a middle linked-list node records the search, the predecessor pointer change, the DELETE step, and before/after snapshots. The PMU replay projection starts from a captured snapshot and applies only recorded head/tail/next-pointer changes to local copies; it does not mutate trace snapshots or a live backend structure.

Added a frontend projection test for a middle-node deletion. It checks the list before the pointer update, after the recorded unlink, against the final snapshot, and verifies the original trace remains unchanged. No defect was found in the projection algorithm.

Trace-selection code clears the previous trace before loading another and resets the step cursor when the new detail arrives. Fetch effects ignore stale responses after selection changes. No confirmed stale-highlight defect was found. The browser-level selection-switch scenario remains unverified.

### CORS implementation

**PASS.** The single global MVC mapping covers `http://localhost` and `http://127.0.0.1` at Vite development ports. Production origins are configured as comma-separated exact origins through `KERNELX_CORS_ALLOWED_ORIGINS`. Credentials are not enabled and there is no unrestricted wildcard origin. Automated preflight tests cover localhost:5173, localhost:5174, 127.0.0.1:5173, a configured production origin, and rejection of an unrelated origin.

An initial full Maven invocation used an older tracked class under `backend/target` because that generated file's timestamp was newer than the changed source, so Maven skipped recompilation; the CORS test then exercised stale bytecode and failed for localhost:5174. The same stale result reproduced in the targeted test. Removing only that generated class forced source recompilation; the full suite then passed. No CORS source change was needed during this phase.

## Changes made

- `frontend/src/test/setup.ts` — common teardown for spies, mocks, timers, storage, and React trees.
- `frontend/src/test/setupIsolation.test.ts` — verifies environment cleanup between tests.
- `frontend/src/pages/CpuInternalsPage.test.tsx` — reinitializes mocked DSA API defaults per test.
- `frontend/src/pages/pmuReplay.test.ts` — verifies middle-node deletion replay and immutability.
- `README.md` and `DEVELOPMENT.md` — label the old 39-test count as the Phase 6A baseline and point to the current report; README status now reflects the partial Phase 7C readiness result.
- `PHASE7C_REPORT.md` — this report.

The CORS configuration from Phase 7B was reviewed and left unchanged. Scheduling algorithms and DSA implementations were not changed. The three untracked files `backend/data/comparisons.json`, `backend/data/experiments.json`, and `backend/data/workloads.json` were preserved and not modified.

## Regression results

| Command | Result |
|---|---|
| Backend `mvn test` after forcing the stale generated CORS class to recompile | **PASS** — 68 tests, 0 failures, 0 errors, 0 skipped |
| Frontend `npm test` — run 1 | **PASS** — 58 tests across 14 files |
| Frontend `npm test` — run 2 | **PASS** — 58 tests across 14 files |
| Frontend `npm test` — run 3 | **PASS** — 58 tests across 14 files |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — 2,615 modules; Vite retains its advisory for the 914.89 KB deferred processor-die chunk |
| `git diff --check` | **PASS** — exit code 0 after documentation and report updates |

All three frontend runs were sequential and completed without failures. Vitest emitted the existing `THREE_CJS_DEPRECATED` warning on each run. The initial Maven run against stale generated bytecode is recorded above; the successful full run compiled 138 backend source files and passed all 68 tests.

## Isolated runtime CORS checks

The existing backends on ports 8081 and 8082 were not stopped or restarted. Read-only health requests returned HTTP 200 on both ports. The isolated backend on port 8083 used temporary JSON storage at `%TEMP%\kernelx-phase7b-20261115`; its health endpoint returned HTTP 200.

| Origin preflight to port 8083 | Result |
|---|---|
| `http://localhost:5173` | **PASS** — HTTP 200; matching allow-origin; no credentials header |
| `http://localhost:5174` | **PASS** — HTTP 200; matching allow-origin; no credentials header |
| `http://127.0.0.1:5173` | **PASS** — HTTP 200; matching allow-origin; no credentials header |
| `https://untrusted.example` | **PASS** — HTTP 403; no allow-origin or credentials header |

## Browser verification gaps

No browser automation was used during Phase 7C. Phase 7B's Chrome session showed populated PDU, PMU, ALU, FPB, and PTU data; trace selection and previous/next controls were exercised for PDU, PMU insertion, FPB, and PTU insertion. It did not complete PMU/PTU deletion replay, ALU collision/removal replay, a live-state comparison specifically around browser replay, page refresh, or console/network inspection. The computer-use safety guard stopped browser interaction when it could not confidently determine the current Windows browser URL. Those items remain **NOT VERIFIED**; this report does not upgrade them based on unit tests or API reads.

## Submission readiness assessment

Core automated stability and CORS verification are **PASS**. The prior frontend timeout run was not reproduced in three repeated runs after test isolation improvements, although its exact historical cause is unknown. The PMU deletion replay projection is now covered by a focused automated test and matches the backend's recorded pointer semantics.

**Recommendation: suitable for submission with browser verification explicitly listed as outstanding, but do not declare final browser replay sign-off.** If browser replay is a submission requirement, run the remaining Phase 7B browser checks in a supported browser-control session before marking the application fully verified.
