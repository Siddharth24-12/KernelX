# KernelX Development Guide

## Current checkpoint

**Phase 3 — JSON persistence and REST API: complete.** Phases 1–3 are implemented and tested. Do not start Phase 4/frontend until the user reviews this checkpoint.

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

The simulation engine remains independent of Spring. The REST layer reads DTO snapshots and does not serialize live linked lists, queues, heaps, hash buckets, or tree nodes.

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

Final complete run: `mvn test` on Java 21.0.13 / Maven 3.10.0 — **29 tests, 0 failures, 0 errors, 0 skipped**. It includes all Phase 1 and Phase 2 suites; JSON file creation, serialization, corruption quarantine, and concurrent writes; API integration across process/simulation/scheduling/memory/events/save/configuration routes; validation and lifecycle conflicts; and CORS preflight.

The API integration tests use real Spring controllers, services, runtime, Jackson repositories, and temporary JSON files; they do not mock API results.

## Known limits

- One in-memory simulation session per application process. Synchronization protects that process; multiple replicas must not share JSON files.
- A run’s schedule is computed at start; process mutations are locked while running/paused. Reset before changing the process set or priorities.
- Ticks are explicitly driven. Speed is metadata for a future polling UI, not a background timer.
- Memory allocations are explicit. Failed allocation reports 409 and does not automatically queue/retry the process.
- No frontend, simulation REST authentication, database, distributed locking, or saved-configuration apply route is included.

## Phase plan

1. Backend foundation and DSA — complete.
2. Simulation engine — complete.
3. JSON persistence and REST API — complete.
4. Frontend foundation — not started.
5. Dashboard and visualizations — not started.
6. Integration and polishing — not started.
7. Final documentation and demo workflow — not started.

Pause for review before Phase 4.
