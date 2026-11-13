# KernelX — Intelligent OS Scheduling Simulator

KernelX is a DSA-focused operating system scheduling simulator. Its backend demonstrates custom process data structures, deterministic CPU scheduling, event history, and contiguous simulated memory allocation.

> **Status:** Phase 1 and Phase 2 are complete. The REST API for simulation workflows, JSON persistence, and frontend have not started.

## Phase 2 features

- `ProcessManager` uses the Phase 1 custom linked list, PID hash table, and process tree. It creates, searches, lists, pauses/resumes, reprioritizes, terminates, and crashes processes. Terminating a parent cascades to descendants and releases their simulated memory.
- `SchedulingService` provides FCFS, non-preemptive SJF, Round Robin, and priority scheduling. Priority supports preemptive and non-preemptive modes.
- Every schedule returns process completion, turnaround, waiting, and response times, averages, total elapsed time, and structured Gantt segments. Idle periods are explicit.
- The Spring-independent `SimulationEngine` starts a schedule and advances it by deterministic ticks. It supports pause, resume, reset, single/multiple ticks, simulation speed metadata, current state, and memory operations. It does not measure host CPU or sleep between ticks.
- `MemoryManager` uses a manually linked contiguous block list and supports First Fit, Best Fit, Worst Fit, allocation, deallocation, fragmentation, and adjacent free-block coalescing.
- `EventManager` stores typed events in the custom queue, including process lifecycle, scheduling, state transitions, memory, crash, and priority events.

## Scheduling policies

| Algorithm | Ready structure | Policy / tie-breaking |
|---|---|---|
| FCFS | Custom FIFO queue | Arrival time, then lower PID; non-preemptive |
| SJF | Custom max heap with reversed comparator | Shortest original burst, then earlier arrival, then lower PID; non-preemptive |
| Round Robin | Custom FIFO queue | Configurable positive quantum; arrivals at a quantum boundary join before the expired process |
| Priority | Custom max heap | Larger numeric priority wins; ties prefer earlier arrival, then lower PID. Preemptive mode yields only to a strictly higher priority. |

All schedules handle arrivals after time zero and emit idle segments. Metrics use `turnaround = completion - arrival`, `waiting = turnaround - burst`, and `response = first start - arrival`.

### Sample preemptive-priority result

Input: P1 priority 2 arrives at 0 with burst 5; P2 priority 5 arrives at 2 with burst 2; P3 priority 5 arrives at 2 with burst 1. Equal priorities choose lower PID.

```json
[
  {"pid":1,"processName":"P1","startTime":0,"endTime":2,"duration":2,"idle":false},
  {"pid":2,"processName":"P2","startTime":2,"endTime":4,"duration":2,"idle":false},
  {"pid":3,"processName":"P3","startTime":4,"endTime":5,"duration":1,"idle":false},
  {"pid":1,"processName":"P1","startTime":5,"endTime":8,"duration":3,"idle":false}
]
```

P1 metrics: completion 8, turnaround 8, waiting 3, response 0. P2: 4, 2, 0, 0. P3: 5, 3, 2, 2.

## Memory model

Memory is a simulated address range, not host RAM. Allocation splits free contiguous blocks. First Fit selects the first sufficient block; Best Fit selects the smallest sufficient block; Worst Fit selects the largest sufficient block. Deallocation merges adjacent free regions. Total, allocated, free, block addresses, and PID mappings are available in a snapshot. A request can fail when total free space is sufficient but fragmented into smaller blocks.

## DSA and complexity

Phase 1 core structures remain custom implementations: `ProcessLinkedList`, `CustomQueue`, `MaxHeap`, `CustomHashTable`, and `ProcessTree` (now supports multiple independent process roots). The new memory allocator is also a manually linked block list. Java collections are used only for method inputs/results and reporting DTOs, not as replacements for core DSA storage.

- PCB linked list: search/removal/update O(n); insertion O(n) due to duplicate-PID check.
- Queue: enqueue/dequeue/peek O(1); traversal O(n).
- Heap: insert/extract O(log n), peek O(1), heapify O(n); update search O(n) + repair O(log n).
- Chained hash table: average put/get/remove O(1), worst O(n); insertion resizing is amortized O(1).
- Process tree: add/search/removal O(n); pre-order traversal O(n).
- Memory blocks: allocation/deallocation O(b) for b blocks; coalescing O(b).
- Scheduling: arrival sort O(n log n); execution visits each simulated CPU tick, with ready heap operations O(log n). Space is O(n + g), where g is Gantt segment count.

## Backend structure

```text
backend/
├── pom.xml
└── src/
    ├── main/java/com/kernelx/
    │   ├── KernelXApplication.java
    │   ├── controller/HealthController.java
    │   ├── dsa/                    # Phase 1 custom structures
    │   ├── model/                  # PCB, metrics, scheduling, memory, events, state DTOs
    │   └── service/                # ProcessManager, SchedulingService, SimulationEngine, MemoryManager, EventManager
    └── test/java/com/kernelx/     # DSA, engine, scheduler, memory, and Spring tests
README.md
DEVELOPMENT.md
```

## Run and test (Windows PowerShell)

Required: JDK 21 and Maven 3.9+. The Codex shell currently inherits Java 8 and has no Maven command on `PATH`, though JDK 21 is installed. For the verified session build, Apache Maven 3.10.0 was downloaded under `%TEMP%\kernelx-build-tools\apache-maven-3.10.0` and its published SHA-512 checksum verified. In a new terminal where tools still do not resolve, set:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:MAVEN_HOME = Join-Path $env:TEMP 'kernelx-build-tools\apache-maven-3.10.0'
$env:Path = "$env:JAVA_HOME\bin;$env:MAVEN_HOME\bin;$env:Path"
java -version
javac -version
mvn -version
```

Run all backend tests:

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn test
```

Start the backend (currently exposes the Phase 1 health endpoint only; Phase 2 services are not yet mapped to REST):

```powershell
cd C:\Users\atsid\OneDrive\Desktop\KernelX\backend
mvn spring-boot:run
```

Health check: `http://localhost:8080/api/health`.
If port 8080 is occupied, use `mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8081"` and open `http://localhost:8081/api/health`. Startup was verified on port 8081 because 8080 was already in use in this environment.

## Test result

`mvn test` completed successfully on Java 21.0.13 / Maven 3.10.0: **24 tests, 0 failures, 0 errors, 0 skipped**. Coverage includes all Phase 1 DSA tests and the Spring endpoint, four scheduling modes, idle/arrival handling, tie-breaking, metrics/Gantt data, process transitions and events, memory strategies/fragmentation/deallocation, and simulation controls.

## Current limitations and next phases

- Simulation work is scheduled as a deterministic plan when `start` is called. Process/priority edits made after start do not rebuild the active plan.
- The speed setting is timing metadata for a later polling UI; ticks advance only when explicitly requested.
- Memory allocation is explicit through the engine; allocation failure does not automatically queue a process or retry later.
- Process-manager operations are currently used from Java/service code and tests; Phase 2 does not expose simulation REST endpoints.
- There is no simulation REST API, JSON persistence, or frontend yet.

The next planned phase is Phase 3: JSON persistence and REST APIs. Stop here for review before proceeding.
