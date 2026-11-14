# KernelX Development Guide

## Current checkpoint

**Phase 5B — processor die and heap replay implemented.** Phase 4 frontend remains complete. All eight pages are implemented: Overview, Processes, CPU Scheduler, Memory Manager, Process Tree, Event Monitor, Simulation Archive and Settings. The process-tree REST traversal endpoint is read-only and cycle-safe. Phase 5B implements an interactive processor die and actual Java MaxHeap traces. Replay is bounded, historical and read-only; Phase 5C and later remain not started. See [PHASE5A_DESIGN.md](PHASE5A_DESIGN.md).

## Phase 3 implementation

### JSON persistence

- `backend/data/simulations.json`: completed-run snapshots containing schedule options, Gantt segments, process snapshots/metrics, memory state, and event history.
- `backend/data/configurations.json`: named algorithm, quantum, priority-mode, memory, and speed settings.
- `backend/data/event_logs.json`: structured persistent `SystemEvent` records.
- Separate archive/configuration/event services use `JsonFileRepository<T>`; records are persistence DTOs and do not capture custom DSA internals.
- Missing files/directories are created. Invalid JSON or wrong-root/null records are quarantined as `.corrupt-<uuid>.json`, then the active file is initialized to an empty array. Original corrupted bytes remain available.
- Writes are synchronized per repository, written to a unique same-directory temporary file, flushed, then replaced atomically where supported (replacement move is the fallback).
- API tests and JSON repository tests use isolated temporary directories. Tests do not read or overwrite the real backend data files.

### REST and runtime safety

- Process, simulation, scheduling, memory, event, archive, and configuration controllers expose the routes documented in `API.md`.
- `SimulationRuntimeService` is the singleton API boundary for one session. Its synchronized methods serialize process mutations, ticks, and snapshots. Process and memory edits are rejected while a run is active/paused so the start-time scheduling plan remains consistent.
- `@RestControllerAdvice` returns one error DTO and maps invalid input to 400, missing resources to 404, invalid lifecycle/resource conflicts to 409, and storage/unexpected failures to a generic 500 response without stack traces.
- Central CORS policy allows the future Vite origin `http://localhost:5173`.
- `server.port` defaults to 8081 and can be changed with `SERVER_PORT`.

## Architecture

```text
REST controllers
  ├── SimulationRuntimeService (single synchronized in-memory session)
  │   ├── ProcessManager → Custom LinkedList + HashTable + ProcessTree
  │   ├── SimulationEngine → SchedulingService → Custom Queue / MaxHeap
  │   └── MemoryManager + EventManager
  ├── SimulationArchiveService → simulations.json
  ├── ConfigurationStoreService → configurations.json
  └── EventLogPersistenceService → event_logs.json

GlobalExceptionHandler + centralized CORS
```

The simulation engine remains independent of Spring. The REST layer reads DTO snapshots and does not serialize live linked lists, queues, heaps, hash buckets, or tree nodes. The frontend uses typed Axios endpoint modules and reads these real snapshots; scheduling and memory allocation remain server-owned.

## Phase 4 frontend

- Stack: React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts and Lucide React.
- `frontend/src/api/` centralizes HTTP requests, DTO interfaces and API error parsing. Configure the API through `VITE_API_BASE_URL`; see `frontend/.env.example`.
- `frontend/src/hooks/useSystemData.ts` polls processes, memory, simulation state and events in one non-overlapping batch every 3.5 seconds. The interval is cleared when the shell unmounts.
- `frontend/src/layouts/AppShell.tsx` owns the responsive navigation and status bar. All eight page routes are functional and lazy loaded.
- Overview reads actual process counts, simulation status/time, memory blocks, execution segments and persistent events. It does not claim physical CPU utilization.
- Processes supports create, search, state filtering, sorting, detail inspection, priority change, pause/resume and confirmed terminate. Mutations respect the backend's active-run lock.
- Scheduler supports FCFS, SJF, Round Robin and Priority, priority preemption, RR quantum, start/pause/resume/step/reset, backend Gantt segments and scheduling metrics. It does not calculate a schedule in TypeScript.
- Memory visualizes the ordered contiguous block list, supports First/Best/Worst Fit allocation and deallocation, and derives free-region/fragmentation readouts from the returned memory snapshot.
- Process Tree reads `/api/processes/tree`, displays the actual custom first-child/next-sibling hierarchy, and supports expand/collapse and process details. Traversal omits revisited links to avoid malformed cycles.
- Event Monitor displays only backend events, chronologically ordered by simulation time and event ID, with text, event-type and PID filters.
- Simulation Archive implements list/save/load/delete for simulations and configurations. Snapshot load is read-only because the backend has no restore-to-runtime operation. Destructive actions use confirmation dialogs.
- Settings reports the API URL/health and saves browser-local scheduler defaults, which Scheduler applies when opened.
- Deep Graphite `#20221F` dominates the canvas and panels, Soft Cloud White `#F3F2EC` carries readable text and selected controls, and Sunshine Yellow `#F5D547` is reserved for primary actions, active simulation cues and allocations. Restrained palette-derived neutrals provide depth and separation.
- The application is responsive, uses accessible labels/focus states, lazy-loads page bundles, and provides loading, empty, disconnected, conflict and success feedback.
- Navigation links point to implemented routes; the app uses the official KernelX palette and retains the four verified core pages.
- See `FRONTEND_API_MAPPING.md` for exact endpoint/method/body/response mappings and capability limits.

## Files added or changed in Phase 3

- `backend/pom.xml`: Jakarta Bean Validation starter.
- `backend/src/main/resources/application.properties`: port, storage directory, and default-memory environment properties.
- `backend/src/main/java/com/kernelx/config/KernelXConfiguration.java`, `CorsConfiguration.java`.
- REST controllers: `ProcessController.java`, `SimulationController.java`, `MemoryController.java`, `SavedSimulationController.java`, `ConfigurationController.java`.
- API DTOs under `backend/src/main/java/com/kernelx/dto/`, including request/response and saved-snapshot types.
- `backend/src/main/java/com/kernelx/exception/GlobalExceptionHandler.java`.
- `backend/src/main/java/com/kernelx/persistence/JsonFileRepository.java`, `PersistenceException.java`.
- Services added: `SimulationRuntimeService.java`, `SimulationArchiveService.java`, `ConfigurationStoreService.java`, `EventLogPersistenceService.java`; `EventManager.java` now supports a persistence sink.
- `backend/data/simulations.json`, `configurations.json`, `event_logs.json`.
- Tests: `Phase3ApiIntegrationTest.java`, `JsonFileRepositoryTest.java`; `KernelXApplicationTests.java` now directs storage to a temporary directory.
- Documentation: `API.md`, `README.md`, and this file.

## API reference

See [API.md](API.md) for every route, body/response examples, success/error statuses, filters, CORS, PowerShell requests, and persistence details. Routes are grouped under:

- `/api/processes`
- `/api/simulation` (lifecycle, scheduling, Gantt, metrics, event history)
- `/api/memory`
- `/api/simulations`
- `/api/configurations`
- `/api/health`

Frontend API mapping: [FRONTEND_API_MAPPING.md](FRONTEND_API_MAPPING.md).

## Frontend commands (Windows PowerShell)

Start the backend in one terminal using the JDK/Maven setup below. Start Vite in a second terminal:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Vite serves `http://localhost:5173`. If the API uses port 8082, change `VITE_API_BASE_URL` to `http://localhost:8082` in `frontend/.env` before starting Vite. Run frontend verification from `frontend/`:

```powershell
npm run typecheck
npm test
npm run build
```

Verified with Node 24.15.0 / npm 11.12.1, Vite 8.3.8, Vitest 5.1.0 and React Router 7.18.5. TypeScript check and production build pass; **20 frontend tests pass**. Coverage includes tree empty/error/selection, event filters, archive operations, settings persistence/health, scheduler defaults, navigation and CPU Internals replay projection/controls.

## Environment and commands (Windows PowerShell)

This Codex shell inherits Java 8 on PATH and does not resolve `javac`/`mvn`, although JDK 21.0.13 is installed at `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`. The verified build used Apache Maven 3.10.0 in `%TEMP%\kernelx-build-tools\apache-maven-3.10.0`. Configure the current terminal if necessary:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:MAVEN_HOME = Join-Path $env:TEMP 'kernelx-build-tools\apache-maven-3.10.0'
$env:Path = "$env:JAVA_HOME\bin;$env:MAVEN_HOME\bin;$env:Path"
java -version
javac -version
mvn -version
```

Run all tests:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn test
```

Start on the Phase 3 default port (8081):

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn spring-boot:run
```

Health check: `http://localhost:8081/api/health`.

If the port is already in use, set a different one:

```powershell
$env:SERVER_PORT = '8082'
mvn spring-boot:run
```

In this environment, port 8081 was occupied. The app was started on 8082; `GET /api/health` returned HTTP 200 with `status: UP`, and `GET /api/memory` returned the initialized simulated memory map.

The running application writes to `backend/data/` when started from the backend directory. For an alternate path, set `$env:KERNELX_DATA_DIRECTORY = 'C:\path\to\kernelx-data'` before startup.

## Test results

Final complete run: `mvn test` on Java 21.0.13 / Maven 3.10.0 — **34 tests, 0 failures, 0 errors, 0 skipped**. It includes process-tree empty/nested API responses, cycle-safe custom-tree traversal, JSON persistence, API lifecycle/archive routes, validation and CORS preflight, plus heap trace recording and API integration.

The API integration tests use real Spring controllers, services, runtime, Jackson repositories, and temporary JSON files; they do not mock API results.

## Known limits

- One in-memory simulation session per application process. Synchronization protects that process; multiple replicas must not share JSON files.
- A run’s schedule is computed at start; process mutations are locked while running/paused. Reset before changing the process set or priorities.
- Ticks are explicitly driven. Speed is metadata for a future polling UI, not a background timer.
- Memory allocations are explicit. Failed allocation reports 409 and does not automatically queue/retry the process.
- No simulation REST authentication, database, distributed locking, or saved-simulation restore route is included. Saved configurations are loaded into the scheduler frontend and submitted through the existing start route.

## Phase plan

1. Backend foundation and DSA — complete.
2. Simulation engine — complete.
3. JSON persistence and REST API — complete.
4. Frontend foundation and all eight pages — complete.
5. CPU internals visualization — Stage 5A and Stage 5B complete; Stage 5C and later not started.
6. Integration and polishing — deferred.
7. Final documentation and demo workflow — deferred.

Phase 4 is complete. Stage 5B remains gated on review of the Stage 5A design. Do not start Phase 6.
