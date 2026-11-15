# KernelX Phase 7A — Final Application Audit

**Audit date:** 2026-11-15
**Scope:** Read-only review and isolated verification. No application source, configuration, or user data was changed. This report is the only intended workspace addition.

## Overall readiness

**PARTIALLY READY.** The backend and frontend automated suites pass. The principal API workflows passed against an isolated backend using temporary JSON storage, including a backend restart. The custom DSA implementations and diagnostic trace provenance are supported by source inspection, unit tests, and live traces. The CPU Internals page and 3D processor scene were opened in Chrome; orbit, zoom, unit focus, and camera reset responded. Live browser playback of populated traces remains unverified because the open frontend uses the protected backend on port 8081, and its histories were empty. A confirmed CORS configuration gap blocks alternate frontend origins such as port 5174 and `127.0.0.1:5173`.

No fixes were made. Findings and recommended changes are listed below for a follow-up implementation task.

## 1. Environment and commands

Project: `C:\Users\atsid\OneDrive\Desktop\KernelX`

Environment observed:

- OpenJDK / `javac`: **21.0.13**
- Maven: **3.10.0**
- Node/npm and frontend versions: frontend reports Vite **8.3.8**, Vitest **5.1.0**; Node/npm versions were not separately queried in this audit.
- Existing listeners before testing: backend ports **8081** and **8082**; frontend ports **5173** and **5174**. They were left running and untouched.

Commands completed:

```powershell
java -version
javac -version
mvn -version
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn test
cd C:\Users\atsid\OneDrive\Desktop\KernelX\frontend
npm test
npm run typecheck
npm run build
```

For live HTTP checks, a separate backend was started on port **8083** with `SERVER_PORT=8083` and `KERNELX_DATA_DIRECTORY` set to `C:\Users\atsid\AppData\Local\Temp\kernelx-phase7a-fc0aa201e05b499484e8edfe6732fd95`. That backend was restarted once against the same directory to test reload, then stopped. Port 8083 is now free. No application was restarted on 8081 or 8082. Temporary audit data was outside the project data directory.

## 2. Backend verification

| Check | Status | Evidence |
|---|---|---|
| Full Maven suite | **PASS** | `mvn test`: 66 tests, 0 failures, 0 errors, 0 skipped; `BUILD SUCCESS`. |
| Request validation and error mapping | **PASS** | Live invalid process request returned 400; unknown PID returned 404; step while READY returned 409. The suite also covers API validation and error cases. |
| FCFS, SJF, Round Robin, Priority | **PASS** | Each algorithm was started with real processes, queried through scheduling/Gantt/metrics endpoints, stepped to completion, and reset. RR used quantum 2. |
| Gantt and scheduling metrics | **PASS** | Live `/api/simulation/gantt`, `/scheduling`, and `/metrics` returned populated results for all four algorithms. |
| Memory allocation algorithms | **PASS** | Live First, Best, and Worst Fit allocation and release succeeded. A fragmented 1,024-unit layout produced distinct actual placements for a 100-unit probe: First Fit at 100, Best Fit at 320, Worst Fit at 894. All test allocations were released. |
| JSON persistence/reload | **PASS** | After restarting the isolated backend against the same temp directory, its saved workload, simulation archive record, configuration, comparison, two experiment reports, and event history were present. |
| Reset behavior | **PASS** | Reset returned READY, kept process definitions, cleared allocated memory and run state, and retained event history. |
| Workloads, comparison, experiments, analytics, archive | **PASS** | Live create/read/load/execute workload; compare FCFS vs Priority; execute scheduling and memory experiments; fetch analytics; save/read simulation and configuration. The resulting records survived restart. |
| API integration-test breadth | **PASS** | Spring integration tests exercise controller groups for processes/tree, lifecycle/scheduling/memory/events/archive/configuration, workloads, analytics, comparisons, experiments, and PDU/PMU/ALU/FPB/PTU. Not every CRUD method was repeated manually against the live server. |

### Endpoint smoke verification

The live server returned successful responses for health, process create/list/tree/delete, all four scheduler starts and read APIs, simulation step/reset, memory allocate/deallocate, workload create/read/load/execute, simulation archive save/read, configuration save/read, comparison run/read, both experiment types/read, analytics snapshot, event history, and each diagnostic snapshot/list/detail family.

The complete route surface was also inspected in the Spring controllers and covered by the integration tests. Some individual endpoint permutations (for example every archive/configuration/workload delete/update route) were not manually called in this audit; those are **NOT VERIFIED live** beyond automated coverage.

## 3. Frontend verification

| Check | Status | Evidence |
|---|---|---|
| `npm test` | **PASS** | 55 tests passed across 13 files. |
| `npm run typecheck` | **PASS** | TypeScript project check exited successfully. |
| `npm run build` | **PASS** | Production build completed. Vite reports `ProcessorDieScene` at 914.89 KB (242.09 KB gzip), over its 500 KB advisory threshold. The CPU Internals page is a separate 45.40 KB chunk. |
| API base URL | **PASS** for default config | Axios reads `VITE_API_BASE_URL`, falls back to `http://localhost:8081`, and has an 8-second timeout. The checked-in example uses port 8081. |
| Axios errors | **PASS** by inspection | `errorMessage` handles API response messages, request timeout, unreachable backend, and generic errors. |
| Loading/empty/error states | **PASS** by tests and browser | Component suites include empty/error/retry states; the open CPU Internals page showed empty trace and DSA states instead of a blank view. |
| Navigation/routing | **PASS** by tests and browser | All routes are lazy-loaded in `App.tsx`; the browser rendered the shell and CPU Internals route. |
| Responsive/visual review | **NOT VERIFIED** | One Chrome viewport (about 793×858 logical pixels) was inspected. Mobile/tablet breakpoints and other pages were not visually audited. |

Frontend tests emit a `THREE_CJS_DEPRECATED` warning. The production build also emits the large deferred processor-die chunk advisory.

## 4. End-to-end workflow audit

All operations below used the isolated backend and temporary JSON directory unless stated otherwise.

| Workflow | Status | Result |
|---|---|---|
| 1. Manual process creation | **PASS** | Created a root and two children through `/api/processes`; PTU tree returned two children. |
| 2. FCFS, SJF, RR, Priority | **PASS** | All four real scheduler runs completed. RR quantum was 2. |
| 3. Gantt chart and metrics | **PASS** | Populated Gantt and metrics were returned for each run. |
| 4. Allocate/release all fit strategies | **PASS** | All three strategies allocated and released memory. The fragmented placement scenario distinguished all three policies. |
| 5. Create/save a workload | **PASS** | Saved a two-process parent/child SJF workload. |
| 6. Load and execute workload | **PASS** | Load created the actual hierarchy; execute started and completed the existing SJF runtime. |
| 7. Algorithm comparison | **PASS** | Actual FCFS and Priority results were returned for the saved workload. |
| 8. Scheduling experiment | **PASS** | SJF baseline and Round Robin variant report returned. |
| 9. Memory experiment | **PASS** | First/Best/Worst Fit isolated report returned for an ordered allocation/free sequence. |
| 10. Analytics | **PASS** | `/api/analytics/snapshot` returned the completed runtime projection. |
| 11. Archive | **PASS** | Completed simulation saved and retrieved. Configuration save/retrieval also passed. |
| 12. Process tree | **PASS** | Root/child relationships and recursive subtree termination were reflected in the live API. |
| 13. DSA visualization lab | **PARTIAL** | Browser page and all five unit sections rendered; live API snapshots/traces were exercised. Populated browser replay is **NOT VERIFIED**. |
| 14. Restart/persistence | **PASS** | Saved JSON-backed workload, archive, configuration, comparison, experiments and events reloaded after restart. In-memory diagnostic histories reset on restart as documented. |

## 5. DSA authenticity and diagnostic behavior

Source inspection confirms five custom Java implementations are wired into the application:

- **PMU:** `ProcessLinkedList` stores actual process PCBs; `ProcessManager` delegates process-list operations to it.
- **FPB:** `CustomQueue<T>` is used by the scheduling service’s FIFO ready queue for FCFS and Round Robin.
- **PDU:** `MaxHeap<T>` supplies the SJF/Priority scheduling heap; heap runs come from the Java recorder.
- **ALU:** `CustomHashTable<K,V>` is the live PID index with separate chaining and resizing.
- **PTU:** `ProcessTree` stores the actual first-child/next-sibling process forest.

The unit tests `ProcessLinkedListTest`, `CustomQueueTest`, `MaxHeapTest`, `CustomHashTableTest`, and `ProcessTreeTest` exercise those Java structures. Trace recorder and API integration tests cover real mutations, scheduling queue/heap work, bucket operations, pointer changes and tree operations. Frontend replay tests use recorded-shaped fixtures and check replay projections; they are not evidence of a populated live browser session.

Diagnostic read-only verification:

| Unit | Trace/run count before reads | Count after repeated snapshot/list/detail reads | Result |
|---|---:|---:|---|
| PDU heap runs | 3 | 3 | **PASS**, same run IDs |
| PMU | 32 (retention limit reached) | 32 | **PASS**, same trace IDs; count alone would not detect an eviction, so ordered IDs were compared |
| ALU | 64 (retention limit reached) | 64 | **PASS**, same trace IDs |
| FPB | 2 | 2 | **PASS**, same trace IDs |
| PTU | 9 | 9 | **PASS**, same trace IDs |

Every retained historical detail was fetched during this check. On a fresh backend after restart, repeated empty snapshots/lists created zero traces. After two new process insertions, repeated `/api/processes`, process-tree, and PMU/ALU/PTU snapshot reads preserved IDs and counts (PMU 4, ALU 5, PTU 2). The replay code is read-only by implementation/tests; the populated trace replay itself was not exercised in the browser.

## 6. Browser and WebGL verification

**Browser:** Google Chrome, existing window at `http://localhost:5173/internals`.

| Browser check | Status | Observation |
|---|---|---|
| CPU Internals loads | **PASS** | Route rendered without a blank screen. Header showed API connected. |
| PDU, PMU, ALU, FPB, PTU sections | **PASS** | All five unit areas and their expected empty-state labels were present. |
| 3D processor die | **PASS** | The processor geometry and unit labels were visible in the Chrome screenshot. |
| Lazy-loaded scene | **PASS** for build split; runtime network timing **NOT VERIFIED** | Build output contains a separate `ProcessorDieScene` chunk; the scene appeared on the CPU Internals route. No Network-panel request timing was captured. |
| Unit focus | **PASS** | Clicking the ALU on the die opened the focused ALU view; Back to Processor returned to the overview. |
| Orbit | **PASS** | Dragging the empty viewport rotated the visible board. |
| Zoom | **PASS** | Wheel input over the viewport changed the visible scene scale/position. |
| Camera reset | **PASS** | Reset Camera returned the view to its initial overview orientation. |
| Populated snapshots and traces | **NOT VERIFIED in browser** | The open frontend is tied to port 8081 and showed empty process/trace states. The audit did not mutate that existing backend. The populated, isolated API was on 8083 and the frontend was not safely reconfigured to use it. |
| Select PDU/PMU/ALU/FPB/PTU traces and replay forward/back | **NOT VERIFIED in browser** | No selectable history was present in the protected browser session. Frontend automated tests cover selection and playback projections. |
| Browser console | **PARTIAL** | DevTools showed repeated Three.js deprecation/removal warnings (`THREE.Clock` and `PCFSoftShadowMap`). No red runtime error was visible in the captured console, but a complete console export was not obtained; exhaustive error status is **NOT VERIFIED**. |

The accessibility text capture included the WebGL fallback message while the screenshot displayed the 3D scene. This discrepancy should be checked with a screen reader if accessible fallback content is part of the expected experience.

## 7. Bugs and recommended fixes

No application code was changed. Findings are ordered by severity.

| Severity | Status | Finding | Recommended fix |
|---|---|---|---|
| **P2 — local-origin compatibility** | **FAIL confirmed** | `CorsConfiguration` permits only `http://localhost:5173`. Live OPTIONS requests returned 200 with the allow-origin header for that origin, but 403/no allow-origin for `http://localhost:5174` and `http://127.0.0.1:5173`. `frontend/package.json` starts Vite with `--host 127.0.0.1`, while the docs direct users to `localhost:5173`; the two host spellings are distinct browser origins. | Make allowed development origins configurable and include both `localhost` and `127.0.0.1` on the default port. Support the documented alternate dev port (or document that it must be added to the allowlist). Add CORS preflight tests for accepted and rejected origins. |
| **P3 — frontend dependency warnings** | **PASS with warning** | Chrome console and Vitest emitted Three.js deprecation warnings; Three.js reports `THREE.Clock` is deprecated and `PCFSoftShadowMap` has been removed. Current scene still rendered. | Identify/update the transitive `three-stdlib`/Drei callers to use `THREE.Timer` and `PCFShadowMap`, or align compatible Three/R3F dependency versions. Add a console-warning regression check if the project adopts a clean-console requirement. |
| **P3 — production payload size** | **PASS with warning** | The lazy `ProcessorDieScene` production chunk is 914.89 KB minified (242.09 KB gzip), above Vite’s 500 KB advisory threshold. The CPU Internals route itself is 45.40 KB. | Profile the scene’s Three.js/Drei dependency graph and consider reducing imports or further route-level splitting. Preserve visual behavior and verify with a browser before changing it. |
| **P3 — documentation drift** | **FAIL confirmed** | README currently records the Phase 6E 55-test count and also retains a later stale “Frontend tests: 39 passed” statement. Its environment paragraph also describes Java 8/no Maven, inconsistent with the present verified Java 21/Maven installation. | Remove the duplicate obsolete frontend count and either make environment setup guidance generic or label historic machine-specific setup as such. |
| **P3 — fallback accessibility text** | **NOT VERIFIED** | Accessibility capture included “3D processor view unavailable” while the visual capture showed the die. | Inspect the fallback node in browser accessibility tools and confirm it is hidden from assistive technology whenever WebGL succeeds. |

## 8. Overall assessment and remaining checks

The documented default local workflow and core backend workflows are in good shape: all automated suites pass, the four schedulers return their own results, allocator placement is distinct under all three fit policies, saved JSON records reload after a backend restart, and diagnostic reads left trace identity lists unchanged. DSA UI structure and camera interactions are present and operable.

This is not a complete final sign-off because:

1. The confirmed CORS origin mismatch can break a frontend served from `127.0.0.1:5173` or port `5174`.
2. Populated DSA trace selection and forward/back replay were not verified in a browser against an isolated populated backend.
3. Responsive layouts and an exhaustive browser-console scan remain unverified.

Recommended next step: fix the CORS origin configuration and README drift in a separate approved implementation task, then repeat browser replay using an isolated frontend/backend pair and capture console/network results. No Phase 7 fixes were applied during this audit.
