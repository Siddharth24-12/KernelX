# KernelX — Intelligent OS Scheduling Simulator

KernelX is a DSA-centered operating system scheduling simulator. The backend now includes custom data structures, a deterministic simulation engine, JSON persistence, and REST APIs. It deliberately simulates CPU and memory; it does not report measurements from the host computer.

> **Status:** Phases 1–4, CPU Internals Phases 5A–5F, and Phases 6A–6D are implemented. Phase 6E has not started.

## Features

- Process management backed by the custom linked list, PID hash table, and process forest. Supports create, lookup/list, priority changes, pause/resume, termination, and crash handling in the service layer.
- FCFS, non-preemptive SJF, Round Robin, and preemptive/non-preemptive priority scheduling. Reports completion, turnaround, waiting, and response metrics, averages, and Gantt segments including CPU idle intervals.
- Synchronized single-session simulation controls: start, pause, resume, step, reset, and read state.
- First Fit, Best Fit, and Worst Fit contiguous simulated memory with fragmentation reporting and free-block coalescing.
- Typed event history persisted as JSON.
- Save/list/retrieve/delete completed simulation records and named scheduler configurations.
- Workload Studio with six deterministic templates, editable process definitions, validation, JSON-backed CRUD, and execution through the existing scheduler.
- Algorithm Comparison runs one immutable workload through independent backend scheduler instances, compares actual metrics and Gantt output, and saves completed reports as JSON.
- System Analytics separates actual per-tick CPU history and live memory/process state from persisted events and historical scheduling comparison reports.
- Experimentation Lab runs immutable saved workload variants through isolated scheduler instances, and replays a single ordered allocation/free sequence against First, Best and Worst Fit memory arenas.
- Interactive process hierarchy from the backend’s custom process tree; searchable chronological event monitor; JSON-backed archive/configuration management; browser-local scheduler defaults and API health settings.
- JSON writes use temporary files and atomic replacement when supported. Corrupt files are quarantined for recovery.
- REST errors share a safe JSON response; CORS is configured for `http://localhost:5173`.

See [API.md](API.md) for the backend request/response reference and [FRONTEND_API_MAPPING.md](FRONTEND_API_MAPPING.md) for frontend coverage and capability limits.

## DSA implementation

- `ProcessLinkedList`: PCB storage; PID operations O(n). The Phase 5C PMU exposes actual logical-node snapshots and bounded operation traces; diagnostic API polling reads do not generate trace events.
- `CustomQueue<T>`: FIFO ready/event storage; enqueue/dequeue O(1). The Phase 5E FIFO Process Buffer records actual queue operations from FCFS/Round Robin scheduling queues; EventManager history queues are excluded. Historical queue traces are read-only and bounded.
- `MaxHeap<T>`: priority and SJF ready sets; insert/extract O(log n), peek O(1).
- `CustomHashTable<K,V>`: PID index using separate chaining and resizing; average lookup O(1). The Phase 5D ALU exposes actual bucket snapshots and bounded `PUT`/`GET`/`REMOVE` traces; diagnostic reads are read-only.
- `ProcessTree`: process hierarchy with independent roots; add/search/removal O(n).
- Phase 5F PTU instruments the actual first-child/next-sibling forest and exposes bounded, read-only snapshots and historical operation traces.
- `MemoryManager`: manual linked block list; fit allocation and coalescing O(b) for b blocks.

The new persistence layer stores DTO snapshots and never serializes the live custom structures.

## Project layout

```text
frontend/
├── src/api/              # Shared typed Axios client and endpoint modules
├── src/components/       # Workstation controls, states and panels
├── src/hooks/            # Controlled backend polling
├── src/layouts/          # Persistent sidebar/topbar shell
├── src/pages/            # Overview, Processes, Workload Studio, Analytics, Scheduler, Memory and tools
└── src/styles.css        # Graphite/cloud/yellow design system
backend/
├── data/
│   ├── simulations.json
│   ├── configurations.json
│   ├── workloads.json
│   ├── comparisons.json
│   └── event_logs.json
├── src/main/java/com/kernelx/
│   ├── config/          # Spring beans, CORS
│   ├── controller/      # REST controllers
│   ├── dsa/              # Manual custom data structures
│   ├── dto/              # API and persistence records
│   ├── exception/        # Central API error mapping
│   ├── model/            # Simulation domain types
│   ├── persistence/      # Atomic synchronized JSON repository
│   └── service/          # Runtime, workload, process, scheduler, memory, event, archive services
└── src/test/java/com/kernelx/
    ├── controller/       # Spring API integration tests
    ├── dsa/              # Structure unit tests
    ├── persistence/      # JSON storage tests
    └── service/          # Engine and domain tests
API.md
README.md
DEVELOPMENT.md
FRONTEND_API_MAPPING.md
```

## Technology

- Java 21, Spring Boot 3.5.16, Maven
- Jackson for JSON and local file persistence
- Jakarta Bean Validation and JUnit 5
- React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide React, Three.js, React Three Fiber and Drei

## Algorithm Comparison (Phase 6B)

Open **Algorithm Comparison** from the navigation, choose a saved workload or built-in template, and select FCFS, SJF, Round Robin quantum variants, and either Priority mode. The backend snapshots the workload and creates a fresh `SchedulingService` (with fresh trace recorders) for each selected configuration. It invokes the existing Java algorithms and never reads or mutates the active simulation runtime.

Each report includes the exact workload snapshot, configuration, Gantt segments (including idle time), per-process completion/turnaround/waiting/response values, averages, CPU utilization (`busy CPU ticks / total elapsed ticks`), throughput (`completed processes / total elapsed ticks`), and metric leaders with ties. Reports are stored in `comparisons.json` using the existing atomic JSON repository.

Start the backend with `mvn spring-boot:run` from `backend/` and the frontend with `npm run dev` from `frontend/`. See [API.md](API.md) for comparison endpoints and request examples.

## System Analytics (Phase 6C)

Open **System Analytics** from navigation or `/analytics`. The CPU view polls actual runtime snapshots and tick samples; a sample is recorded only after each real simulated tick. Executed Gantt intervals are grouped from those tick samples, while the full scheduler plan is shown separately. Memory figures use the live allocator blocks; external fragmentation is `100 × (1 − largest free block / total free memory)`, or 0% when memory is fully allocated. Allocation failures are recorded as structured events.

Lifecycle and event views use persisted event IDs, process IDs, types, descriptions and simulation-time values. Events do not contain wall-clock timestamps or run IDs, so matching simulation ticks from separate resets are combined in frequency charts. Historical performance filters saved Phase 6B comparison reports and remains separate from current simulator measurements. CPU telemetry is bounded in memory to 4,096 samples and clears on backend restart; event logs and comparisons use their existing JSON persistence.

## Experimentation Lab (Phase 6D)

Open **Experimentation Lab** from navigation or `/experiments`. Scheduling experiments use a saved workload snapshot as the baseline; each variant can change algorithm, Round Robin quantum, Priority preemption, and per-process arrival, burst and priority values. Variants run through fresh instances of the existing `SchedulingService`; metrics, process rows and Gantt segments are returned from those actual scheduler results. The active simulator and saved workload are not mutated.

Memory experiments use the workload's configured total memory and require the same ordered ALLOCATE/DEALLOCATE sequence to be replayed in isolated First Fit, Best Fit and Worst Fit arenas. Allocation failures are recorded independently for each strategy. External fragmentation is `100 × (1 − largest free block / total free memory)`, or zero when total free memory is zero. A free for a PID whose allocation failed under a strategy is reported as a no-op for that strategy.

Completed reports are persisted separately in `experiments.json`; the API writes only after every baseline and variant completes. Reports contain the workload snapshot, baseline and variant configurations, actual results, signed and absolute metric differences, percent changes where a nonzero baseline allows them, per-process scheduling deltas and tied best values. Scheduling reports compare average wait/turnaround/response, utilization and throughput; memory reports compare allocation outcomes, free/allocated capacity and fragmentation. Metric leaders are per metric and do not imply one universally best policy. See [API.md](API.md) for request limits and endpoint schemas.

## Run on Windows (PowerShell)

Required: JDK 21 and Maven 3.9+ for the backend; Node.js 20.19+ and npm for the frontend. Application port defaults to **8081** and can be changed with `SERVER_PORT`. Storage defaults to `backend/data/` relative to the backend working directory; use `KERNELX_DATA_DIRECTORY` to choose another path.

In this Codex shell, inherited PATH still selects Java 8 and does not contain Maven. For the verified build, JDK 21.0.13 was used with Apache Maven 3.9.11 in the Windows temp directory. Set these paths in PowerShell if needed:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:MAVEN_HOME = Join-Path $env:TEMP 'apache-maven-3.9.11'
$env:Path = "$env:JAVA_HOME\bin;$env:MAVEN_HOME\bin;$env:Path"
java -version
javac -version
mvn -version
```

Run the complete backend test suite:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn test
```

Start the API on port 8081:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn spring-boot:run
```

Health check: `http://localhost:8081/api/health`.

If 8081 is occupied, use another port:

```powershell
$env:SERVER_PORT = '8082'
mvn spring-boot:run
```

The API integration suite exercises process-tree, simulation, events, archive, ALU and FPB endpoints using MockMvc and isolated temporary JSON data directories.

## Verification

`mvn test` passed on Java 21.0.13 / Maven 3.9.11: **55 tests, 0 failures, 0 errors, 0 skipped**. Coverage includes FIFO queue mutations and pointer states, FCFS/RR traces, bounded trace history, read-only FPB diagnostics, actual PID-table collisions/rehashing, PMU/PDU/PTU regression tests, workload CRUD/validation/execution, process-tree API relationships and lifecycle, scheduler/runtime behavior and temporary JSON persistence.

Frontend tests: **39 passed**; `npm run typecheck` and `npm run build` pass. The build reports the existing large CPU Internals bundle warning from Three.js. Coverage includes Workload Studio editing, validation/load/run flow, empty/error states and navigation alongside FPB, ALU, PTU, process tree, event filtering, archive, settings and scheduler behavior.

## Runtime and persistence limits

- One in-memory simulation session is supported per application instance. Session access is synchronized; do not point multiple application replicas at the same JSON directory.
- Schedules are snapshots created at simulation start. Process edits made while the simulation is running or paused return `409`; reset before editing.
- Speed is stored as a simulation setting. Ticks advance only when explicitly requested; no wall-clock scheduler is used.
- JSON persistence is local-file storage, not a database or multi-host transaction system.
- Saved configurations can be retrieved and then supplied to `/api/simulation/start`; there is no separate “apply configuration” endpoint.
- A saved simulation is a read-only snapshot; the backend does not provide a resume/restore route. Saved configurations can be loaded into the scheduler UI, which submits supported fields through the existing simulation start endpoint.

## Workload Studio

Saved workloads are stored independently in `backend/data/workloads.json`. Built-in templates are generated deterministically and are not persisted. The editor validates and saves definitions, loads process definitions into the existing simulator, or executes a workload through the existing scheduler. Loading/execution requires an empty process table and a `READY` simulation so unrelated processes cannot be included accidentally. Loading transfers scheduler settings to the Scheduler page; execution starts the schedule immediately. Ticks still advance through Scheduler controls.

See [API.md](API.md#workload-studio-apis) for request formats and route behavior.

## Phases

1. Backend foundation and custom DSA — complete.
2. Simulation engine — complete.
3. JSON persistence and REST API — complete.
4. Frontend foundation, core pages and remaining frontend functionality — complete.
5. CPU internals visualization — Phases 5A–5F complete.
6. Workload Studio, Algorithm Comparison and System Analytics — Phases 6A–6C complete; Phase 6D not started.
7. Final documentation and demo workflow — not started.

Phase 4 and CPU Internals Phases 5B–5F are complete. CPU Internals includes the PDU, PMU, ALU, FIFO Process Buffer and PTU; the PTU reads the real process forest and bounded in-memory operation history. See [PHASE5A_DESIGN.md](PHASE5A_DESIGN.md), [PHASE5D_DESIGN.md](PHASE5D_DESIGN.md), [PHASE5E_DESIGN.md](PHASE5E_DESIGN.md), and [PHASE5F_DESIGN.md](PHASE5F_DESIGN.md).

## Frontend (Phase 4)

All eight pages are Overview, Processes, CPU Scheduler, Memory Manager, Process Tree, Event Monitor, Simulation Archive and Settings. Deep Graphite `#20221F` dominates the canvas and panels; Soft Cloud White `#F3F2EC` supports readable text and select controls; Sunshine Yellow `#F5D547` marks primary actions, active simulation cues and allocations. Scheduler and memory visualizations render actual backend data. See [FRONTEND_API_MAPPING.md](FRONTEND_API_MAPPING.md) for each integration and capability limit.

Install and run from Windows PowerShell:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. To use a backend on 8082, set `VITE_API_BASE_URL=http://localhost:8082` in `frontend/.env` before starting Vite. In another terminal start the backend using the PowerShell setup commands above. Frontend checks:

```powershell
npm run typecheck
npm test
npm run build
```
