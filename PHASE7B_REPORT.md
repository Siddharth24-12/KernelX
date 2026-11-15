# KernelX Phase 7B Report

Date: 2026-11-15

## Summary

**Overall status: PARTIALLY VERIFIED.** The CORS cause was confirmed and fixed, automated CORS tests pass, and real traces were generated across all five DSA panels. Browser trace selection and step navigation were exercised for PDU, PMU, FPB and PTU; an ALU trace was selected and its live collision chain was observed. The browser automation safety guard then stopped interaction before process termination, ALU collision/removal trace replay, a page refresh, and browser console/network inspection could be verified. Phase 7B is not signed off as complete.

## CORS investigation and fix

**Root cause: PASS.** The backend had one global MVC CORS mapping for `/api/**` that allowed only `http://localhost:5173`. There were no controller-level `@CrossOrigin` annotations, no competing global CORS mapping, and no Spring Security configuration/dependency. The frontend API client reads `VITE_API_BASE_URL`, defaulting to port 8081. Thus requests from localhost:5174 and 127.0.0.1:5173 were rejected by the single-origin allowlist.

The mapping now permits HTTP origins on any port for `localhost` and `127.0.0.1`, and accepts additional exact production origins from the comma-separated `KERNELX_CORS_ALLOWED_ORIGINS` environment variable. It does not allow credentials or a wildcard origin. Development configuration is documented in [DEVELOPMENT.md](DEVELOPMENT.md).

Changed application files:

- `backend/src/main/java/com/kernelx/config/CorsConfiguration.java`
- `backend/src/test/java/com/kernelx/controller/CorsConfigurationIntegrationTest.java` (new)
- `DEVELOPMENT.md`
- `PHASE7B_REPORT.md` (this report)

No scheduler, memory, DSA implementation, or frontend source files were changed.

### CORS checks

| Check | Result | Evidence |
|---|---|---|
| `http://localhost:5173` preflight | PASS | HTTP 200; allow-origin echoed; credentials header absent |
| `http://localhost:5174` preflight | PASS | HTTP 200; allow-origin echoed; credentials header absent |
| `http://127.0.0.1:5173` preflight | PASS | HTTP 200; allow-origin echoed; credentials header absent |
| Configured exact production origin | PASS | `https://dashboard.kernelx.example` HTTP 200 in integration test |
| Unrelated origin | PASS | HTTP 403; no allow-origin header |
| Credentials / wildcard behavior | PASS | Credentials are disabled; origin patterns are restricted to the two loopback hostnames; production entries are exact origins |

## Automated verification

Commands were run from the project root unless noted. Java 21 and the installed Maven distribution were placed on `PATH` for backend commands.

| Command | Result |
|---|---|
| `mvn test` (from `backend/`) | PASS — 68 tests, 0 failures, 0 errors, 0 skipped |
| `npm test` (from `frontend/`, first run) | FAIL — 5 failed, 50 passed; several 5-second UI test timeouts and one heading query failure |
| `npm test` (immediate rerun, unchanged source) | PASS — 55 tests passed across 13 files |
| `npm run typecheck` (from `frontend/`) | PASS |
| `npm run build` (from `frontend/`) | PASS — 2,615 modules built; Vite reported a large-chunk advisory for the processor-die bundle |
| `git diff --check` | PASS — exit code 0 |

The first frontend test run's failures did not reproduce on the immediate rerun; their cause was not established, so they remain a test-run stability observation. Maven updated tracked generated files under `backend/target`; those build artifacts were restored to their clean pre-task state. The three untracked JSON files in `backend/data` were preserved rather than deleted or overwritten.

## Isolated runtime

The existing backends on ports 8081 and 8082 were not stopped, restarted, or modified. A separate backend ran on port 8083 with `KERNELX_DATA_DIRECTORY` set to `%TEMP%\kernelx-phase7b-20261115`. A separate Vite server ran on port 5175 with `VITE_API_BASE_URL=http://localhost:8083`.

- Backend health endpoint: PASS — `GET http://localhost:8083/api/health` returned HTTP 200 and `{"mode":"simulation backend foundation","status":"UP","application":"KernelX"}`.
- Frontend: PASS — Vite started at `http://127.0.0.1:5175`; Chrome opened `http://localhost:5175/internals`, showed the CPU Internals view, and displayed `API CONNECTED`.
- Diagnostic read-only checks: PASS — three repeated rounds of snapshots, trace lists and first-trace/run details left counts unchanged: PTU 5, FPB 2, ALU 13, PMU 18, heap/PDU 2 before and after.

## Browser DSA replay

Chrome was used at `http://localhost:5175/internals`. Actual operations were created through the UI in the isolated application. The page rendered the five units and their live data. The browser-control tool then stopped the session because it could not confidently determine the current browser URL on Windows. Per that tool's instruction, no more browser actions were attempted.

| Browser check | Status | Evidence / limitation |
|---|---|---|
| CPU Internals loads, no blank screen | PASS | Chrome rendered the page and showed API connected |
| PDU data and Priority/SJF runs | PASS | Priority run `faff35d4-e6fc-4ff6-b43d-55ba80213e5d` (5 recorded operations) and SJF run `4e26e972-a8a6-4282-a0d0-6241a3762a79` (6 operations) were selected; recorded steps and a swap highlight were visible |
| PDU previous/next replay | PASS | Previous/next controls changed the selected step |
| PMU insertion trace | PASS | `INSERT PID 72016`, trace `95826463-fe17-4115-a729-37317a85e877`, 5 steps; step navigation worked |
| PMU deletion trace | NOT VERIFIED | Process termination was not completed after browser control stopped |
| ALU populated collision chain | PASS | PIDs 72016 and 72032 were created; capacity 16, bucket 1 showed `72032 → 72016`; UI showed one nonempty collision chain |
| ALU collision/removal trace replay | NOT VERIFIED | An ALU GET trace was selected, but it was a miss recorded before insertion. No removal was completed, and no collision/removal trace was replayed |
| FPB FCFS trace | PASS | Trace `adb0c13b-0e10-4717-bba4-1e8f10ac4fad`, associated run `e04d1527-026f-4d8c-964d-3a773205b40d`; two enqueues followed by matching dequeues were displayed |
| FPB Round Robin trace | PASS | Quantum 2 trace `54424506-773c-41ae-8158-87fa4c08a23b`, run `b10eed6a-7d7e-4718-aff9-c436af3672a8`; recorded re-enqueues were verified in trace detail, and browser previous/next navigation worked |
| PTU hierarchy and insertion trace | PASS | Root 73001 and child 73002 appeared in the hierarchy; insertion trace `96c782a5-eccb-476d-b3b5-831ff91239a3` (8 steps) was selected and navigated |
| PTU removal/subtree trace | NOT VERIFIED | No deletion was completed after the browser-control stop |
| All five panels show populated data | PASS | PDU, PMU, ALU, FPB and PTU panels and trace lists were observed in the Internals page |
| Replay proven not to mutate live snapshots | NOT VERIFIED | Repeated diagnostic reads were confirmed read-only; a before/after live-state comparison specifically around browser replay was not completed |
| Panel switching without errors | PASS | All five panels were opened and populated before the browser-control stop |
| Refresh behavior | NOT VERIFIED | Page refresh was not attempted |
| Console errors / failed network requests | NOT VERIFIED | Browser console and network logs were not inspected |
| Screenshots saved as artifacts | NOT VERIFIED | Browser screenshots were observed inline during the session, but no screenshot files were saved |

The browser limitation was the computer-use guard's inability to determine the current browser URL confidently on Windows; it stopped computer use and required that no further browser actions be attempted. Accordingly, the missed checks above are not represented as passed.

## Remaining limitations and readiness recommendation

The CORS implementation and regression coverage are ready based on the automated and isolated runtime results. Browser replay verification remains partial: PMU and PTU deletion, ALU collision/removal trace replay, replay-specific state immutability comparison, refresh behavior, and browser console/network inspection are outstanding. The first frontend test run also had failures that did not reproduce on immediate rerun.

**Recommendation: do not mark Phase 7B fully complete yet.** Complete the remaining browser checks in a usable browser automation session, including a trace-state comparison around replay and the deletion paths. No Phase 6 or later work was started.
