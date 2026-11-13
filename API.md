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
| 404 | Process, saved simulation, configuration, or memory allocation does not exist |
| 409 | Invalid lifecycle action, active-session mutation, insufficient contiguous memory, or incomplete simulation save |
| 500 | Persistence or unexpected server error; details are logged server-side only |

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

List PCB snapshots in insertion order. Errors: `200` with an array.

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

## Memory APIs

### `GET /api/memory`

Returns `{totalMemory, allocatedMemory, freeMemory, blocks}`. Blocks contain `startAddress`, `size`, nullable `pid`, and `free`.

### `POST /api/memory/allocate`

Allocate the PCB’s declared memory requirement. Strategy is optional; if omitted, the most recent simulation start strategy (initially `FIRST_FIT`) is used.

```json
{"pid": 1001, "strategy": "BEST_FIT"}
```

Returns `200` with `{"success": true, "memory": ...}`. Errors: `400` invalid PID/strategy; `404` missing process; `409` no sufficient contiguous block, duplicate allocation, or active simulation.

### `POST /api/memory/deallocate`

Request: `{"pid": 1001}`. Returns `200` with the updated memory snapshot. Adjacent free blocks coalesce. Errors: `404` if the PID has no allocation; `409` during an active run.

## Event API

### `GET /api/simulation/events`

Returns structured event history persisted in `event_logs.json`. Optional filters: `pid` and `type` (for example `?pid=1001&type=STATE_CHANGED`). Event types include `PROCESS_CREATED`, `PROCESS_TERMINATED`, `SCHEDULING_DECISION`, `STATE_CHANGED`, `MEMORY_ALLOCATED`, `MEMORY_DEALLOCATED`, `PROCESS_CRASHED`, `PRIORITY_CHANGED`, simulation-control types, and `CPU_IDLE`. Invalid filters return `400`.

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
