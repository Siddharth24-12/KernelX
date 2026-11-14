# KernelX — Intelligent OS Scheduling Simulator

KernelX is a DSA-centered operating system scheduling simulator. The backend now includes custom data structures, a deterministic simulation engine, JSON persistence, and REST APIs. It deliberately simulates CPU and memory; it does not report measurements from the host computer.

> **Status:** Phases 1–3 complete. Phase 4 frontend is implemented: Overview, Processes, CPU Scheduler, Memory Manager, Process Tree, Event Monitor, Simulation Archive and Settings.

## Features

- Process management backed by the custom linked list, PID hash table, and process forest. Supports create, lookup/list, priority changes, pause/resume, termination, and crash handling in the service layer.
- FCFS, non-preemptive SJF, Round Robin, and preemptive/non-preemptive priority scheduling. Reports completion, turnaround, waiting, and response metrics, averages, and Gantt segments including CPU idle intervals.
- Synchronized single-session simulation controls: start, pause, resume, step, reset, and read state.
- First Fit, Best Fit, and Worst Fit contiguous simulated memory with fragmentation reporting and free-block coalescing.
- Typed event history persisted as JSON.
- Save/list/retrieve/delete completed simulation records and named scheduler configurations.
- Interactive process hierarchy from the backend’s custom process tree; searchable chronological event monitor; JSON-backed archive/configuration management; browser-local scheduler defaults and API health settings.
- JSON writes use temporary files and atomic replacement when supported. Corrupt files are quarantined for recovery.
- REST errors share a safe JSON response; CORS is configured for `http://localhost:5173`.

See [API.md](API.md) for the backend request/response reference and [FRONTEND_API_MAPPING.md](FRONTEND_API_MAPPING.md) for frontend coverage and capability limits.

## DSA implementation

- `ProcessLinkedList`: PCB storage; PID operations O(n).
- `CustomQueue<T>`: FIFO ready/event storage; enqueue/dequeue O(1).
- `MaxHeap<T>`: priority and SJF ready sets; insert/extract O(log n), peek O(1).
- `CustomHashTable<K,V>`: PID index using separate chaining and resizing; average lookup O(1).
- `ProcessTree`: process hierarchy with independent roots; add/search/removal O(n).
- `MemoryManager`: manual linked block list; fit allocation and coalescing O(b) for b blocks.

The new persistence layer stores DTO snapshots and never serializes the live custom structures.

## Project layout

```text
frontend/
├── src/api/              # Shared typed Axios client and endpoint modules
├── src/components/       # Workstation controls, states and panels
├── src/hooks/            # Controlled backend polling
├── src/layouts/          # Persistent sidebar/topbar shell
├── src/pages/            # Overview, Processes, Scheduler, Memory
└── src/styles.css        # Graphite/cloud/yellow design system
backend/
├── data/
│   ├── simulations.json
│   ├── configurations.json
│   └── event_logs.json
├── src/main/java/com/kernelx/
│   ├── config/          # Spring beans, CORS
│   ├── controller/      # REST controllers
│   ├── dsa/              # Manual custom data structures
│   ├── dto/              # API and persistence records
│   ├── exception/        # Central API error mapping
│   ├── model/            # Simulation domain types
│   ├── persistence/      # Atomic synchronized JSON repository
│   └── service/          # Runtime, process, scheduler, memory, event, archive services
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

## Run on Windows (PowerShell)

Required: JDK 21 and Maven 3.9+ for the backend; Node.js 20.19+ and npm for the frontend. Application port defaults to **8081** and can be changed with `SERVER_PORT`. Storage defaults to `backend/data/` relative to the backend working directory; use `KERNELX_DATA_DIRECTORY` to choose another path.

In this Codex shell, inherited PATH still selects Java 8 and does not contain Maven. For the verified build, JDK 21.0.13 was used with Apache Maven 3.10.0 downloaded to the Windows temp directory. Set these paths in PowerShell if needed:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:MAVEN_HOME = Join-Path $env:TEMP 'kernelx-build-tools\apache-maven-3.10.0'
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

The API integration suite exercises process-tree, simulation, events and archive endpoints using MockMvc and isolated temporary JSON data directories.

## Verification

`mvn test` passed on Java 21.0.13 / Maven 3.10.0: **34 tests, 0 failures, 0 errors, 0 skipped**. This includes empty and nested process-tree API responses, cycle-safe custom-tree traversal, API lifecycle/archive persistence on temporary JSON storage, validation, CORS, and actual scheduler heap trace integration.

Frontend tests: **20 passed**; `npm run typecheck` and `npm run build` pass. The build reports a large CPU Internals bundle warning from Three.js. Coverage includes process tree selection/expand/empty/error states, event filtering/order, archive list/save/load/delete, settings persistence/health, scheduler defaults and application navigation.

## Runtime and persistence limits

- One in-memory simulation session is supported per application instance. Session access is synchronized; do not point multiple application replicas at the same JSON directory.
- Schedules are snapshots created at simulation start. Process edits made while the simulation is running or paused return `409`; reset before editing.
- Speed is stored as a simulation setting. Ticks advance only when explicitly requested; no wall-clock scheduler is used.
- JSON persistence is local-file storage, not a database or multi-host transaction system.
- Saved configurations can be retrieved and then supplied to `/api/simulation/start`; there is no separate “apply configuration” endpoint.
- A saved simulation is a read-only snapshot; the backend does not provide a resume/restore route. Saved configurations can be loaded into the scheduler UI, which submits supported fields through the existing simulation start endpoint.

## Phases

1. Backend foundation and custom DSA — complete.
2. Simulation engine — complete.
3. JSON persistence and REST API — complete.
4. Frontend foundation, core pages and remaining frontend functionality — complete.
5. CPU internals visualization — Stage 5A and Stage 5B complete; Stage 5C and later not started.
6. Integration and polishing — not started.
7. Final documentation and demo workflow — not started.

Phase 4 is complete. Phase 5B is implemented: the processor die renders the actual backend Java MaxHeap operation trace for SJF and Priority scheduling. Replay is historical and read-only. Phase 5C and later are not started. See [PHASE5A_DESIGN.md](PHASE5A_DESIGN.md).

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
