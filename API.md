# KernelX REST API

Base URL: `http://localhost:8081`. Content type is `application/json` for requests with bodies. CORS allows `http://localhost:5173` for `/api/**`.

The Spring application defaults to port **8081**. Override it with `SERVER_PORT`, for example `$env:SERVER_PORT=8082`. JSON storage defaults to `backend/data/`; set `KERNELX_DATA_DIRECTORY` to another directory to move it. Total simulated memory defaults to 1024 units (`KERNELX_TOTAL_MEMORY`). Memory is simulated and does not describe the host computer.

## Response and error format

Successful reads/updates return JSON. Resource creation returns `201 Created` with the created object and a `Location` header. Deletes return `204 No Content`.

Errors share this shape and never return stack traces:

```json
{
  "timestamp": "2026-11-13T18:30:00Z",
  "status": 409,
  "error": "Conflict",
  "message": "Simulation must be running before stepping",
  "path": "/api/simulation/step"
}
```

| Status | Meaning |
|---|---|
| 400 | Invalid JSON, enum, path/query value, or validated field |
| 404 | Process, saved simulation, configuration, workload, comparison report, or memory allocation does not exist |
| 409 | Invalid lifecycle action, active-session mutation, insufficient contiguous memory, or incomplete simulation save |
| 500 | Persistence or unexpected server error; comparison execution failures include a safe message naming the failed configuration, while details remain in server logs |

## Health API

### `GET /api/health`

Returns `{ "status": "UP", "application": "KernelX", "mode": "simulation backend foundation" }` when the Spring application is serving requests. This is an application health response, not a host CPU or memory measurement.

## Process APIs

### `POST /api/processes`

Create a process. `parentPid` can be omitted for an independent root process; otherwise the parent must exist.

```json
{
  "pid": 1001,
  "name": "compiler",
  "priority": 5,
  "arrivalTime": 0,
  "burstTime": 8,
  "memoryRequirement": 256,
  "parentPid": -1
}
```

Returns `201` and the process PCB snapshot, including `remainingTime`, state, and metric fields. New processes start in `NEW`; uncomputed completion/turnaround/response fields are `-1`. Errors: `400` invalid field/duplicate PID/unknown parent; `409` while the engine is running or paused.

### `GET /api/processes`

List PCB snapshots in insertion order. This is a diagnostic read of the custom linked list and does not emit a PMU `TRAVERSE` operation, including when the UI's 3.5-second runtime poll calls it. Explicit linked-list traversals performed by process management/simulation operations remain instrumented. Errors: `200` with an array.

### `GET /api/processes/tree`

Return the current process hierarchy as roots with nested `children` arrays. Each node includes `pid`, `name`, `state`, `priority`, `parentPid`, arrival/burst/remaining times, and requested memory. The response is `[]` for an empty process tree. It is a read-only snapshot of the existing first-child/next-sibling custom tree; traversal tracks node identity and omits any link that revisits a node, so malformed links cannot cause an infinite traversal. This endpoint does not change or replace the process data structure.

```json
[
  {"pid":1001,"name":"compiler","state":"NEW","priority":5,"parentPid":-1,"arrivalTime":0,"burstTime":8,"remainingTime":8,"memoryRequirement":256,
   "children":[{"pid":1002,"name":"worker","state":"NEW","priority":4,"parentPid":1001,"arrivalTime":1,"burstTime":3,"remainingTime":3,"memoryRequirement":64,"children":[]}]}
]
```

### `GET /api/processes/{pid}`

Retrieve one process. Errors: `404` when absent.

### `DELETE /api/processes/{pid}`

Terminate a process and all descendants; release their allocated simulated memory. Returns `204`. Errors: `404` if absent; `409` while simulation is running or paused.

### `PATCH /api/processes/{pid}/priority`

Request: `{"priority": 8}`. Priority range is 0–10. Returns the updated PCB. Errors: `400` invalid priority; `404` missing PID; `409` invalid process state or active simulation.

### `POST /api/processes/{pid}/pause`

Pause a process before a simulation run (state becomes `PAUSED`). Returns its PCB. Errors: `404` missing PID; `409` invalid state or active simulation.

### `POST /api/processes/{pid}/resume`

Resume a paused process into `READY`. Returns its PCB. Errors: `404` missing PID; `409` process is not paused or the simulation is active.

Process mutations are locked while an engine run is `RUNNING` or `PAUSED` so changes cannot invalidate its planned schedule. Reset before editing an active run.

## Workload Studio APIs

Saved workload JSON is revalidated against the same semantic constraints when loaded or executed. Invalid persisted content returns `409 Conflict` before process creation begins; request validation errors continue to return `400`.

Workloads are reusable process definitions plus scheduler and memory settings. Saved definitions use the configured JSON data directory in `workloads.json`; built-in templates are deterministic API-provided examples and are never written to disk. Workload execution uses the existing process manager and simulation engine.

Create/update/validate request fields are `name`, `description`, `processes`, `algorithm`, `timeQuantum`, `preemptivePriority`, `totalMemory`, `memoryAllocationStrategy`, and `speed`. Each process has `pid`, `name`, `priority`, `arrivalTime`, `burstTime`, `memoryRequirement`, and optional `parentPid` (`-1` for a root).

- `GET /api/workloads` returns built-in templates followed by saved workload definitions.
- `GET /api/workloads/templates` returns the six read-only templates: Short Jobs, Mixed, CPU Intensive, Arrival Burst, Priority Conflict, and Idle CPU.
- `GET /api/workloads/{id}` returns one saved workload or template.
- `POST /api/workloads` creates a saved workload (`201`); `PUT /api/workloads/{id}` updates one (`200`); `DELETE /api/workloads/{id}` deletes one (`204`). Template deletion returns `409`; unknown IDs return `404`.
- `POST /api/workloads/validate` returns `{valid, errors, warnings}`. Validation checks field constraints, duplicate or active-runtime PIDs, parent existence, self-parenting, and cyclic parent relationships. It warns about initial idle time and combined memory requests above capacity; memory is not implicitly allocated.
- `POST /api/workloads/{id}/load` creates process records and returns `{workloadId, processes}` without starting a run. Parents are created before children regardless of editor row order. Loading requires an empty process table and a `READY` simulation to prevent unrelated jobs joining the workload. The frontend transfers its scheduler settings to the existing CPU Scheduler page.
- `POST /api/workloads/{id}/execute` creates process records and starts the selected scheduler plan. It returns `{workloadId, createdPids, simulation}`. It has the same empty-table and `READY` preconditions as load. It does not advance simulation ticks; use `/api/simulation/step`.

Process ranges match `/api/processes`: positive PID, priority 0–10, nonnegative arrival, positive burst/memory, names up to 80 characters, and up to 256 process definitions. Round Robin requires a positive quantum.

## Simulation APIs

### `POST /api/simulation/start`

Start the single in-memory simulation session. A new run requires state `READY`; reset after a completed run before starting again. Process input is snapshotted at start.

```json
{
  "algorithm": "ROUND_ROBIN",
  "timeQuantum": 2,
  "preemptivePriority": false,
  "totalMemory": 2048,
  "memoryAllocationStrategy": "BEST_FIT",
  "speed": 1.5
}
```

Algorithms: `FCFS`, `SJF`, `ROUND_ROBIN`, `PRIORITY`. Quantum is required and positive for Round Robin. Priority numeric values higher than others run first; preemptive priority only switches for strictly higher priority. `totalMemory` and `speed` are optional; defaults are the current total memory and `1.0`. Strategy is `FIRST_FIT`, `BEST_FIT`, or `WORST_FIT`. Returns a `SimulationSnapshot`. Errors: `400` invalid configuration; `409` run must be reset first or memory cannot be resized while allocated.

### `POST /api/simulation/pause`

Pause a running simulation. Returns current snapshot. Errors: `409` unless state is `RUNNING`.

### `POST /api/simulation/resume`

Resume a paused simulation. Returns current snapshot. Errors: `409` unless state is `PAUSED`.

### `POST /api/simulation/step`

Advance deterministic simulation ticks. The body is optional (one tick) or `{"ticks": 10}`; range is 1–100000. Returns updated state. Errors: `400` invalid count; `409` unless simulation is `RUNNING`.

### `POST /api/simulation/reset`

Reset clock, process state/metrics, schedule, and allocated memory while retaining the process definitions. Returns a `READY` snapshot. Existing events remain in persistent history.

### `GET /api/simulation/state`

Get a consistent snapshot with simulation status, time, total time, speed, current PID, ready/waiting PIDs, and completed Gantt segments.

## Scheduling APIs

These endpoints require a schedule to have been started; otherwise they return `409`.

### `GET /api/simulation/scheduling`

Returns algorithm/options, complete Gantt data, process metrics, averages, and total time.

### `GET /api/simulation/gantt`

Returns an array of `{pid, processName, startTime, endTime, duration, idle}`. Intervals are half-open; `pid: -1` and `idle: true` represent CPU idle time.

### `GET /api/simulation/metrics`

Returns per-process completion, turnaround, waiting, response times, plus their averages.

## CPU heap trace APIs

SJF and Priority scheduling record bounded, historical snapshots of operations on the actual Java `MaxHeap`. These are in-memory replay traces, not the live ready queue: the scheduler heap is temporary and is drained as work is dispatched. Traces are read-only and are not persisted in JSON. The recorder retains at most 8 runs and 4096 steps per run; `truncated` indicates the step limit was reached. FCFS and Round Robin use a queue and do not create heap traces.

### `GET /api/dsa/heap/runs`

List retained run summaries (newest last), with `runId`, algorithm, priority mode, process count, timestamps, step count, and truncation status.

### `GET /api/dsa/heap/runs/{runId}`

Retrieve one trace: metadata, indexed `finalHeap` snapshot, and ordered `steps`. Step kinds include `HEAPIFY`, `INSERT`, `EXTRACT_MAX`, `UPDATE`, `COMPARE`, and `SWAP`; comparison and swap steps include the real heap indices and process snapshots. The response is `404` if the run is absent or has aged out of the bounded history.

## PCB Memory Unit (PMU)

These read-only endpoints expose snapshots and bounded traces from `ProcessManager`'s actual custom singly linked list. Snapshot reads follow the private `next` links directly and do not record operations. Node identifiers are stable logical IDs for a node's lifetime, not physical addresses. Traces are held in memory only and reset when the backend restarts; at most 32 traces, 1024 steps per trace, and 2048 nodes per historical snapshot are retained. The current snapshot includes the complete live list. Missing/evicted trace IDs return `404`.

### `GET /api/dsa/pmu/snapshot`

Returns the current ordered PCB nodes with list ID, size, head/tail logical IDs, and each node's actual `nextNodeId`.

### `GET /api/dsa/pmu/traces`

Returns recent summaries for actual `INSERT`, `TRAVERSE`, `SEARCH`, and `DELETE` calls. PMU snapshot/trace reads and the polled `GET /api/processes` listing do not emit traces. Process insertion itself performs a real duplicate PID search, so that search can also appear in history. Normal PID lookup uses the existing hash table and is not mislabeled as linked-list search.

### `GET /api/dsa/pmu/traces/{traceId}`

Returns immutable before/after snapshots and ordered operation steps, including actual visits/comparisons, node creation, head/tail and `next` pointer changes, insertion/deletion and completion. `simulationTime` is `null` because list operations currently have no simulation-tick context.

## Memory APIs

### `GET /api/memory`

Returns `{totalMemory, allocatedMemory, freeMemory, blocks}`. Blocks contain `startAddress`, `size`, nullable `pid`, and `free`.

### `POST /api/memory/allocate`

Allocate the PCB’s declared memory requirement. Strategy is optional; if omitted, the most recent simulation start strategy (initially `FIRST_FIT`) is used.

```json
{"pid": 1001, "strategy": "BEST_FIT"}
```

Returns `200` with `{"success": true, "memory": ...}`. Errors: `400` invalid PID/strategy; `404` missing process; `409` no sufficient contiguous block, duplicate allocation, or active simulation. A no-contiguous-block failure is also recorded as `MEMORY_ALLOCATION_FAILED` in persistent event history.

### `POST /api/memory/deallocate`

Request: `{"pid": 1001}`. Returns `200` with the updated memory snapshot. Adjacent free blocks coalesce. Errors: `404` if the PID has no allocation; `409` during an active run.

## Event API

### `GET /api/simulation/events`

Returns structured event history persisted in `event_logs.json`. Optional filters: `pid` and `type` (for example `?pid=1001&type=STATE_CHANGED`). Event types include `PROCESS_CREATED`, `PROCESS_TERMINATED`, `SCHEDULING_DECISION`, `STATE_CHANGED`, `MEMORY_ALLOCATED`, `MEMORY_DEALLOCATED`, `MEMORY_ALLOCATION_FAILED`, `PROCESS_CRASHED`, `PRIORITY_CHANGED`, simulation-control types, and `CPU_IDLE`. Events contain monotonic `eventId` and `simulationTime`, not wall-clock timestamps or run IDs. Invalid filters return `400`.

## System Analytics API (Phase 6C)

### `GET /api/analytics/snapshot`

Returns a read-only projection of the current runtime and bounded CPU tick history: simulation status/time, current running and ready PIDs, completed-process count, tick-derived observed Gantt intervals, the backend scheduled Gantt plan and completed schedule segments, memory block metrics, process table state counts/metrics, and CPU tick samples. This endpoint does not invoke scheduler work or instrumented DSA lookups.

CPU samples are emitted after each actual simulation tick, once per simulation tick (not wall-clock polling). Each contains the run ID, resulting simulation time, PID that executed during that interval (`null` means the interval was idle), process name, current ready/waiting counts, completed count, cumulative busy/idle ticks and cumulative utilization. Utilization is `busy ticks / (busy ticks + idle ticks) × 100`. `observedGantt` groups consecutive actual tick samples for the current run into intervals; the separate scheduled Gantt is the full backend plan and is not presented as already executed. Before any tick is executed, observed utilization is `null` and observed Gantt is empty; current state is never used to manufacture earlier samples. The most recent 4,096 samples across runs are retained in memory across simulation resets; oldest samples are discarded when full, `historyTruncated` is set, and a backend restart clears this history.

Memory utilization is `allocatedMemory / totalMemory × 100`. Largest free block and block counts come from the current ordered `MemoryManager` snapshot. External fragmentation is `100 × (1 − largest free block / total free memory)` when free memory is positive, and 0 when there is no free memory. It describes how split free blocks limit a contiguous allocation and is distinct from total free capacity. Allocation failure count is aggregated from persisted `MEMORY_ALLOCATION_FAILED` events.

Process state counts are taken from the current PCB table, including PAUSED and retained completed PCBs. Manually terminated processes are removed from that table and therefore only remain visible through lifecycle events. Process rows expose backend waiting/turnaround/response values as stored; negative, not-yet-computed metrics are not inferred. State transitions and process creation/termination history come from `/api/simulation/events`.

The endpoint is observational and does not change the active runtime. Structured event history remains persistent and unbounded under the existing JSON event-log policy. Its event IDs define record order; its simulation-time values may repeat after reset, and the event DTO has no wall-clock timestamp or run association. The frontend groups actual event records by type and simulation tick and labels persisted comparisons separately as historical performance.

## Saved simulation APIs

Only a `COMPLETED` simulation may be saved. A saved record contains an ID/name/timestamp, scheduling result and metrics, PCB snapshots, memory snapshot, and structured event history.

### `POST /api/simulations/save`

Request: `{"name":"Round Robin run 1"}`. Returns `201` and the saved record. Errors: `400` blank/long name; `409` simulation is not completed.

### `GET /api/simulations`

List saved simulations.

### `GET /api/simulations/{id}`

Retrieve a saved simulation. Errors: `404` unknown ID.

### `DELETE /api/simulations/{id}`

Delete a saved simulation. Returns `204`; errors: `404` unknown ID.

## Configuration APIs

### `POST /api/configurations`

Save a named scheduler/memory/speed configuration:

```json
{
  "name": "Priority demo",
  "algorithm": "PRIORITY",
  "timeQuantum": 0,
  "preemptivePriority": true,
  "totalMemory": 2048,
  "memoryAllocationStrategy": "WORST_FIT",
  "speed": 1.0
}
```

Returns `201` and the saved configuration. For Round Robin, `timeQuantum` must be positive. Errors: `400` invalid fields.

### `GET /api/configurations`

List saved configurations.

### `GET /api/configurations/{id}`

Retrieve a configuration. Errors: `404` unknown ID.

### `DELETE /api/configurations/{id}`

Delete a configuration. Returns `204`; errors: `404` unknown ID.

## PowerShell examples

```powershell
$base = 'http://localhost:8081'
$process = Invoke-RestMethod -Method Post -Uri "$base/api/processes" -ContentType 'application/json' -Body '{"pid":1001,"name":"worker","priority":5,"arrivalTime":0,"burstTime":6,"memoryRequirement":128}'
Invoke-RestMethod -Method Post -Uri "$base/api/simulation/start" -ContentType 'application/json' -Body '{"algorithm":"ROUND_ROBIN","timeQuantum":2,"preemptivePriority":false,"memoryAllocationStrategy":"FIRST_FIT"}'
Invoke-RestMethod -Method Post -Uri "$base/api/simulation/step" -ContentType 'application/json' -Body '{"ticks":20}'
Invoke-RestMethod -Method Get -Uri "$base/api/simulation/gantt"
Invoke-RestMethod -Method Post -Uri "$base/api/simulations/save" -ContentType 'application/json' -Body '{"name":"RR demo"}'
```

## Persistence and concurrency

`backend/data/simulations.json`, `configurations.json`, and `event_logs.json` are JSON arrays of persistence DTOs, not internal linked lists, queues, heaps, hash tables, or live engine objects. Missing files/directories are created automatically. Invalid JSON is moved to a uniquely named `.corrupt-<id>.json` backup and the active file is reset to an empty array, preserving the damaged bytes for recovery.

Each repository serializes requests under a lock, writes a unique temporary file in the same directory, flushes it, then atomically replaces the target when the filesystem supports it. It falls back to replacement move when atomic moves are unavailable. The single Spring runtime service synchronizes session mutations and snapshots so REST ticks do not execute concurrently. This is an in-process, single-instance design; multiple application replicas must not share these JSON files.

## CPU Internals — Associative Lookup Unit

`GET /api/dsa/alu/snapshot` returns the current PID table used by `ProcessManager`: stable table ID, capacity, size, load factor and bucket snapshots in actual head-to-tail chain order. Entries use stable logical IDs (not memory addresses) and contain copied PCB metadata. A bounded snapshot reports truncation if its configured entry/bucket safety limit is reached.

`GET /api/dsa/alu/traces` returns up to 64 recent actual `PUT`, `GET` and `REMOVE` table operations. `GET /api/dsa/alu/traces/{traceId}` returns the recorded steps, bucket snapshots and mutation before/after snapshots where applicable. Instrumentation is attached to the real custom hash table: chain visits, key comparisons, genuine collisions, bucket/next pointer changes and resize rehashes are captured at operation time. Reads of the ALU endpoints inspect bucket arrays directly and never create operations. Historical operations are read-only.

Trace history is bounded in-memory state and is cleared when the backend restarts. A trace holds at most 2,048 steps; diagnostic table snapshots are bounded to 4,096 buckets and 2,048 entries. An operation that exceeds a trace bound retains its recorded prefix and sets `truncated`.

## CPU Internals — FIFO Process Buffer

`GET /api/dsa/fpb/snapshot` describes current queue availability. In the current synchronous scheduling architecture, the FCFS/Round Robin ready queue is created, consumed to calculate the schedule, and discarded before the API returns; the endpoint therefore returns `{ "active": false, "queue": null, "message": "..." }` rather than a fabricated live queue.

`GET /api/dsa/fpb/traces` lists up to 16 completed FCFS or Round Robin runs with a trace ID, scheduling-run ID, queue ID, process count, actual operation count, start/completion timestamps, and truncation state. `GET /api/dsa/fpb/traces/{traceId}` returns its initial/final snapshots and ordered recorded enqueue/dequeue steps, or HTTP 404 for an unknown or evicted trace. Each step includes actual queue ordering after the operation, size before/after, front/rear logical node IDs, and process data captured at that point. Logical IDs label software queue nodes; they are not physical addresses.

Only `SchedulingService.FifoReady` passes an observer to `CustomQueue`. The separate `EventManager` history queue uses the no-op observer, and SJF/Priority use `MaxHeap`, so neither produces FIFO process-buffer activity. Queue history is in-memory and resets when the backend restarts. Retention is bounded to 16 runs, 2,048 recorded operations per run, 512 nodes per snapshot and 32,768 node snapshots per run; summaries preserve the actual total operation count and traces set `truncated` when records or queue details exceed those bounds. FPB snapshot/list/detail endpoints are read-only.
## Process Tree Visualization Unit (PTU)

The PTU exposes the existing `ProcessTree` forest as read-only snapshots and bounded operation history. Nodes retain the Java first-child/next-sibling links; a sibling chain may represent multiple children. The endpoints do not call instrumented search/traversal methods and never create trace entries.

- `GET /api/dsa/ptu/snapshot` → `{size, rootCount, rootPids, nodes, truncated}`. Each node contains `nodeId` (the logical PID alias, not a memory address), `pid`, `name`, `state`, `parentPid`, `firstChildPid`, and `nextSiblingPid`. The flat node list is capped at 2,048 rows, with cycle/repeated-node detection.
- `GET /api/dsa/ptu/traces` → ordered `PtuTraceSummary[]` metadata (`traceId`, operation, target PID, timestamp, step count, truncation).
- `GET /api/dsa/ptu/traces/{traceId}` → full recorded step list and final tree snapshot. Missing IDs return the standard 404 error response.

Traces are in-memory only: at most 32 traces and 2,048 steps per trace. Restarting the backend clears PTU history; process tree contents themselves remain runtime state and are not persisted. Replay presents actual recorded operation steps and pointer changes over the recorded final tree. Per-step full-tree snapshots are not captured, so playback does not claim reconstructed intermediate tree states.

## Algorithm Comparison (Phase 6B)

Comparisons use a saved workload (including a read-only built-in template ID) and run each configuration against a fresh copy of the same process definition. Each run uses a newly created `SchedulingService` and the existing Java scheduling algorithms. The comparison service does not access the active simulation runtime. Completed reports are appended to `comparisons.json` only after every selected run and metric summary succeeds.

### `POST /api/comparisons`

Run between 2 and 12 distinct scheduling configurations. Configuration IDs and algorithm/parameter signatures must be unique. Round Robin requires `timeQuantum` from 1 to 100000; other algorithms reject a nonzero quantum. `preemptivePriority` is supported only for Priority.

```json
{
  "workloadId": "saved-or-template-workload-id",
  "configurations": [
    {"configurationId":"fcfs","label":"FCFS","algorithm":"FCFS"},
    {"configurationId":"rr-q2","label":"Round Robin · q2","algorithm":"ROUND_ROBIN","timeQuantum":2},
    {"configurationId":"priority-preemptive","label":"Priority preemptive","algorithm":"PRIORITY","preemptivePriority":true}
  ]
}
```

Returns `201` with `ComparisonReport`: `comparisonId`, workload ID/name, timestamp, immutable `workloadSnapshot`, `results[]`, and `winners[]`. Each result contains its exact configuration, actual `GanttSegment[]` (idle intervals included), per-process completion/turnaround/waiting/response values, three averages, `totalTime`, CPU utilization, and throughput. Utilization is `sum(non-idle Gantt durations) / totalTime × 100`; throughput is `process count / totalTime`. `totalTime` is the scheduling result's elapsed integer time, including leading idle intervals. A nonpositive total time fails the comparison rather than fabricating a metric. Winner objectives minimize average waiting, turnaround and response; maximize utilization and throughput. Equal metric values return all tied configuration IDs and labels. Invalid configuration/workload input returns `400`; a scheduler failure returns `500` and persists no partial report.

### `GET /api/comparisons`

List saved report records. Returns `200` and `ComparisonReport[]`.

### `GET /api/comparisons/{id}`

Retrieve one saved report. Returns `200`; unknown IDs return `404`.

### `DELETE /api/comparisons/{id}`

Delete a saved report. Returns `204`; unknown IDs return `404`.

Comparison reads do not invoke scheduling. JSON persistence follows the existing atomic repository convention and uses the configured `kernelx.data-directory` (`KERNELX_DATA_DIRECTORY` when launched through the documented application properties).

## Interactive OS Experiments (Phase 6D)

Experiments use a saved workload ID, including a built-in template, and copy its full definition into the report. They never load or modify the active runtime or saved workload. Completed reports are stored separately in `experiments.json`, using the same atomic JSON repository. The service appends a report only after the baseline and every requested variant complete.

### `POST /api/experiments`

Executes one scheduling or memory experiment and returns `201` with a persisted `ExperimentReport`. The experiment name is required (up to 100 characters); variants require unique IDs and labels. Scheduling and memory requests have separate fields and reject unsupported combinations.

Scheduling request example:

```json
{
  "name": "Priority and burst study",
  "description": "Compare changes against the saved workload baseline",
  "baseWorkloadId": "saved-or-template-workload-id",
  "type": "SCHEDULING",
  "variants": [
    {"variantId":"rr-q2","label":"Round Robin q2","algorithm":"ROUND_ROBIN","timeQuantum":2,"processChanges":[{"pid":62001,"burstTime":6}]},
    {"variantId":"priority-p","label":"Preemptive Priority","algorithm":"PRIORITY","preemptivePriority":true,"processChanges":[{"pid":62002,"arrivalTime":3,"priority":9}]}
  ]
}
```

The baseline takes its algorithm, quantum and preemption mode from the immutable workload snapshot. Each variant may override algorithm, Round Robin quantum, Priority preemption, and per-process `arrivalTime`, `burstTime`, or `priority`; omitted fields retain the snapshot value. PID, name, memory request and parent relationship stay fixed. One to 12 variants are accepted; a variant must differ from the baseline and sibling variants must be unique. Round Robin quantum is 1–100000 and preemption is supported only for Priority. Results reuse the existing scheduler and include actual Gantt segments, averages, CPU utilization, throughput, per-process metrics and baseline deltas.

Memory request example:

```json
{
  "name": "Allocator sequence",
  "description": "Same operations under each fit policy",
  "baseWorkloadId": "saved-or-template-workload-id",
  "type": "MEMORY",
  "variants": [
    {"variantId":"best","label":"Best Fit","memoryStrategy":"BEST_FIT"},
    {"variantId":"worst","label":"Worst Fit","memoryStrategy":"WORST_FIT"}
  ],
  "memoryOperations": [
    {"operation":"ALLOCATE","pid":1,"amount":64},
    {"operation":"DEALLOCATE","pid":1},
    {"operation":"ALLOCATE","pid":2,"amount":32}
  ]
}
```

The workload's `totalMemory` is the shared arena size. First Fit is the baseline; both Best Fit and Worst Fit are required variants. Between 1 and 512 ordered operations are replayed unchanged in a new `MemoryManager` per policy. Allocation requests require a positive PID and amount no larger than the arena. A PID must be deallocated before another allocation request for that PID; a deallocation must follow an earlier allocation request. An allocation may fail due to contiguous-space limits; that failure is measured and subsequent free of that PID is a no-op for that policy. Results contain each operation outcome and final address-ordered block layout.

Scheduling metrics use the Phase 6B definitions: utilization is non-idle Gantt duration / elapsed schedule time × 100; throughput is process count / elapsed time. Memory external fragmentation is `100 × (1 − largestFreeBlock / freeMemory)` when free memory is positive, otherwise zero. The report includes baseline values, signed difference (`variant − baseline`), absolute difference, and percentage change (`difference / abs(baseline) × 100`) when the baseline is nonzero. Winners are listed per metric, include ties, and are not a universal ranking. Memory allocated capacity and successful allocations/free capacity/largest block maximize; failed allocations and fragmentation minimize.

Invalid experiment input returns `400`. Runtime failures return `500` and do not persist a partial report. Experiment scheduler and memory event contexts are isolated; they do not alter the simulation, JSON event history, original workload or diagnostic DSA traces.

### `GET /api/experiments`

List completed reports (`200`, `ExperimentReport[]`).

### `GET /api/experiments/{id}`

Retrieve one completed report (`200`); unknown IDs return `404`.

### `DELETE /api/experiments/{id}`

Delete a saved report (`204`); unknown IDs return `404`.
