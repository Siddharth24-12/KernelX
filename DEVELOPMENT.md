# KernelX Development Guide

## Current checkpoint

**Phase 2 — operating system simulation engine: implemented and tested.** The work in this phase adds process management, scheduling algorithms, a deterministic tick engine, simulated contiguous memory, and structured events. Phase 3 persistence/REST workflows and frontend are not started.

## Environment

This Codex session still resolves `java` to Java 8.0.481 and cannot find `javac` or `mvn` on inherited `PATH`. JDK 21.0.13 is installed at `C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`. To run the build here, Maven 3.10.0 was downloaded to `%TEMP%\kernelx-build-tools\apache-maven-3.10.0` and its published SHA-512 checksum verified. With the paths set, commands reported Java 21.0.13, javac 21.0.13, and Maven 3.10.0.

If the tools do not resolve in a new PowerShell terminal, use:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:MAVEN_HOME = Join-Path $env:TEMP 'kernelx-build-tools\apache-maven-3.10.0'
$env:Path = "$env:JAVA_HOME\bin;$env:MAVEN_HOME\bin;$env:Path"
java -version
javac -version
mvn -version
```

For a permanent setup, point `JAVA_HOME` and `MAVEN_HOME` at the installed directories and add their `bin` folders to Windows `PATH`.

## Phase 2 architecture

```text
ProcessManager
  ├── ProcessLinkedList       # canonical ordered PCB storage
  ├── CustomHashTable         # PID lookup
  └── ProcessTree             # multiple process roots and parent-child hierarchy

SimulationEngine (Spring-independent)
  ├── SchedulingService       # deterministic complete schedule + metrics/Gantt DTOs
  │   ├── CustomQueue         # FCFS and Round Robin ready set
  │   └── MaxHeap             # SJF and priority ready set
  ├── MemoryManager           # linked contiguous blocks; fit strategies and coalescing
  └── EventManager            # structured events held in CustomQueue
```

`SchedulingService` is pure with respect to live PCBs: it schedules immutable `SchedulingProcess` inputs and returns `SchedulingResult`. `SimulationEngine` takes that deterministic plan and advances its half-open Gantt intervals one tick at a time. No wall-clock timers, host CPU measurements, database, persistence, or frontend were introduced.

### Scheduling behavior

- **FCFS:** FIFO, non-preemptive. Processes order by arrival time and then lower PID.
- **SJF:** non-preemptive; chooses the shortest original burst among arrived ready processes. Ties choose earlier arrival then lower PID.
- **Round Robin:** FIFO with a required positive quantum. Arrivals at a quantum boundary are queued before the expired process is reinserted.
- **Priority:** higher numeric value wins. Equal priorities choose earlier arrival, then lower PID. Preemptive mode switches only when a strictly higher priority arrives; non-preemptive mode waits for completion.
- Every mode includes idle intervals and computes completion, turnaround, waiting, and response times plus averages.

The Phase 1 process tree now supports a forest (multiple independent roots), which reflects independent operating system processes while retaining the existing first-child/next-sibling implementation.

### Memory and event behavior

Memory is a simulated contiguous address space, not machine RAM. First/Best/Worst Fit select a sufficient free block; allocations split it and deallocation merges adjacent free blocks. Allocation fails if there is no contiguous block large enough, even if total free memory would otherwise be sufficient.

Events are typed `SystemEvent` records with sequence ID, simulation time, optional PID, type, and description. Process, state, scheduling, priority, memory, crash, CPU-idle, and simulation-control events are recorded.

## Files added or modified in Phase 2

- Modified `backend/src/main/java/com/kernelx/model/ProcessControlBlock.java` and `ProcessState.java`: completion/wait/turnaround/response fields, start/completion/reset helpers, and PAUSED state.
- Added models under `backend/src/main/java/com/kernelx/model/`: `SchedulingAlgorithm`, `SchedulingProcess`, `GanttSegment`, `ProcessMetrics`, `SchedulingResult`, `SimulationStatus`, `SimulationSnapshot`, `SimulationConfiguration`, memory DTOs/strategy, and system event DTO/type.
- Added services under `backend/src/main/java/com/kernelx/service/`: `ProcessManager`, `SchedulingService`, `SimulationEngine`, `MemoryManager`, `EventManager`.
- Modified `backend/src/main/java/com/kernelx/dsa/ProcessTree.java` to support independent roots; retained existing structure and tests.
- Added scheduler, manager, memory, and engine tests under `backend/src/test/java/com/kernelx/service/`; extended `ProcessTreeTest` with multiple-root coverage.
- Updated `README.md` with algorithms, sample output, commands, test result, and limitations.

## Run and test (Windows PowerShell)

Set environment paths first if required using the commands under Environment. Then run the complete backend suite:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn test
```

Start Spring Boot:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn spring-boot:run
```

The current Spring web endpoint is `GET http://localhost:8080/api/health`. Phase 2 services are independent Java services and have not yet been exposed as REST endpoints.

Port 8080 was already occupied during the startup check. The backend started on 8081 with `mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8081"`, and `GET http://localhost:8081/api/health` returned HTTP 200 with `status: UP`.

Phase 2 verification: `mvn test` — **24 tests, 0 failures, 0 errors, 0 skipped**, including the Phase 1 data structure suite. `mvn clean test` initially could not remove a compiled class directory under the OneDrive workspace, so the successful complete verification used `mvn test`, which recompiled changed source/test classes and ran all tests. If this clean failure occurs on your machine, close any process holding backend `target` files and rerun `mvn clean test`; plain `mvn test` is sufficient to verify changes.

## Sample scheduling run

Preemptive priority inputs:

```text
P1: priority 2, arrival 0, burst 5
P2: priority 5, arrival 2, burst 2
P3: priority 5, arrival 2, burst 1
```

Tie policy selects lower PID, producing these Gantt intervals:

```text
PID 1 [0,2) → PID 2 [2,4) → PID 3 [4,5) → PID 1 [5,8)
```

P1 metrics: completion 8, turnaround 8, waiting 3, response 0. P2: 4, 2, 0, 0. P3: 5, 3, 2, 2. Structured sample JSON is in `README.md`.

## Known limits

- Scheduling plan is created at simulation start. Process creation, pause/resume, or priority changes do not re-plan a running simulation; apply process changes before starting or reset first.
- Speed is metadata for a future UI; callers explicitly request ticks and no timer sleeps are used.
- Memory allocations are explicit; a failed allocation does not automatically block/retry the process.
- The Spring app exposes only the Phase 1 health route; process management and simulation are not yet wired to REST.
- No simulation REST endpoints, JSON persistence, or React frontend have been implemented.

## Phase plan

1. Backend foundation and custom DSA — complete.
2. Operating system simulation engine — complete.
3. JSON persistence and REST APIs — not started.
4. Frontend foundation — not started.
5. Dashboard and visualizations — not started.
6. Integration and polishing — not started.
7. Final documentation — not started.

Pause for review before Phase 3.
