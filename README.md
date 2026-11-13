# KernelX — Intelligent OS Scheduling Simulator

KernelX is a DSA-centered operating system scheduling simulator. The backend now includes custom data structures, a deterministic simulation engine, JSON persistence, and REST APIs. It deliberately simulates CPU and memory; it does not report measurements from the host computer.

> **Status:** Phases 1–3 complete. React/frontend work has not started.

## Features

- Process management backed by the custom linked list, PID hash table, and process forest. Supports create, lookup/list, priority changes, pause/resume, termination, and crash handling in the service layer.
- FCFS, non-preemptive SJF, Round Robin, and preemptive/non-preemptive priority scheduling. Reports completion, turnaround, waiting, and response metrics, averages, and Gantt segments including CPU idle intervals.
- Synchronized single-session simulation controls: start, pause, resume, step, reset, and read state.
- First Fit, Best Fit, and Worst Fit contiguous simulated memory with fragmentation reporting and free-block coalescing.
- Typed event history persisted as JSON.
- Save/list/retrieve/delete completed simulation records and named scheduler configurations.
- JSON writes use temporary files and atomic replacement when supported. Corrupt files are quarantined for recovery.
- REST errors share a safe JSON response; CORS is configured for `http://localhost:5173`.

See [API.md](API.md) for the complete request/response reference and examples.

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
```

## Technology

- Java 21, Spring Boot 3.5.16, Maven
- Jackson for JSON and local file persistence
- Jakarta Bean Validation and JUnit 5
- No database; no frontend yet

## Run on Windows (PowerShell)

Required: JDK 21 and Maven 3.9+. Application port defaults to **8081** and can be changed with `SERVER_PORT`. Storage defaults to `backend/data/` relative to the backend working directory; use `KERNELX_DATA_DIRECTORY` to choose another path.

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

This environment had 8081 occupied during live verification; the app started on 8082 and `/api/health` returned `status: UP`. The API integration suite exercised the simulation endpoints using MockMvc and isolated temporary JSON data directories.

## Verification

`mvn test` passed on Java 21.0.13 / Maven 3.10.0: **29 tests, 0 failures, 0 errors, 0 skipped**. Coverage includes all Phase 1 and 2 tests, JSON missing/corrupt/concurrent-write cases, API lifecycle and persistence, validation/status mapping, and CORS.

## Runtime and persistence limits

- One in-memory simulation session is supported per application instance. Session access is synchronized; do not point multiple application replicas at the same JSON directory.
- Schedules are snapshots created at simulation start. Process edits made while the simulation is running or paused return `409`; reset before editing.
- Speed is stored as a simulation setting. Ticks advance only when explicitly requested; no wall-clock scheduler is used.
- JSON persistence is local-file storage, not a database or multi-host transaction system.
- Saved configurations can be retrieved and then supplied to `/api/simulation/start`; there is no separate “apply configuration” endpoint.
- React, persistence-backed event log management controls, and broader UI workflows are future work.

## Phases

1. Backend foundation and custom DSA — complete.
2. Simulation engine — complete.
3. JSON persistence and REST API — complete.
4. Frontend foundation — not started.
5. Dashboard and visualizations — not started.
6. Integration and polishing — not started.
7. Final documentation and demo workflow — not started.

Stop here for review before Phase 4.
