# KernelX frontend ↔ backend API mapping

Base URL comes from `VITE_API_BASE_URL` (default `http://localhost:8081`). The frontend types mirror the Spring DTOs and the app sends requests through the shared Axios client.

| Frontend feature | Backend endpoint | HTTP method | Request body | Response structure | Integration status |
|---|---|---|---|---|---|
| Runtime availability indicator | `/api/health` and core data routes | GET | None | `{status, application, mode}` and runtime snapshots | Shell confirms connectivity from live data reads; Settings also queries `/api/health` directly and displays the configured API base URL. |
| Overview: process counts/states | `/api/processes` | GET | None | `ProcessResponse[]` (`pid`, `name`, state, priority, timing and memory request) | Integrated; refreshes with controlled 3.5 s polling. |
| Overview: simulation tick/status | `/api/simulation/state` | GET | None | `SimulationSnapshot` (`status`, algorithm, current time, total time, current PID, ready/waiting PIDs, completed segments) | Integrated; no hardware utilization is inferred. |
| Overview: memory capacity and blocks | `/api/memory` | GET | None | `MemorySnapshot` and ordered `{startAddress,size,pid,free}` blocks | Integrated; values are from backend response. |
| Overview: recent system activity | `/api/simulation/events` | GET | Optional `pid`, `type` query params | `SystemEvent[]` (`eventId`, `simulationTime`, nullable `pid`, `type`, `description`) | Integrated; latest events are shown; backend currently returns the persisted event history. |
| Process table and inspection | `/api/processes`, `/api/processes/{pid}`, `/api/memory` | GET | None | `ProcessResponse[]` / `ProcessResponse` and `MemorySnapshot` | Integrated; search, state filter, sorting and detail drawer use returned PCB fields; the table separates actual allocation blocks from the PCB memory request. |
| Create process | `/api/processes` | POST | `{pid,name,priority,arrivalTime,burstTime,memoryRequirement,parentPid?}` | Created `ProcessResponse`, HTTP 201 | Integrated; form validates required values/ranges, defaults to root (`parentPid=-1`), and can select an existing parent PID. |
| Change priority | `/api/processes/{pid}/priority` | PATCH | `{priority}` (0–10) | Updated `ProcessResponse` | Integrated; disabled during active/paused run. |
| Pause/resume process | `/api/processes/{pid}/pause`, `/api/processes/{pid}/resume` | POST | None | Updated `ProcessResponse` | Integrated where the process state permits it; backend conflicts are surfaced. |
| Terminate process | `/api/processes/{pid}` | DELETE | None | HTTP 204; descendants are also terminated by backend | Integrated with a browser confirmation. |
| Scheduler configuration / start | `/api/simulation/start` | POST | `{algorithm,timeQuantum?,preemptivePriority?,totalMemory?,memoryAllocationStrategy,speed?}` | `SimulationSnapshot` | Integrated for FCFS, SJF, Round Robin and Priority; positive quantum for RR; priority preemption only appears for Priority; total memory defaults to the current backend capacity and can be adjusted subject to backend allocation rules. |
| Simulation controls | `/api/simulation/pause`, `/resume`, `/step`, `/reset` | POST | Step: `{ticks}` (1–100000); other routes no body | `SimulationSnapshot` | Integrated; backend lifecycle validation is displayed as a readable error. Step defaults to one tick when the UI control is one. |
| Scheduler Gantt chart | `/api/simulation/gantt` or `/api/simulation/scheduling` | GET | None | `GanttSegment[]` or `SchedulingResult`; half-open intervals, idle uses `pid=-1`/`idle=true` | Integrated; actual backend plan rendered with time axis, hover details and current-tick playhead. |
| Scheduler metrics | `/api/simulation/scheduling` | GET | None | `SchedulingResult` (`processes`, averages, total time, Gantt) | Integrated; per-process completion/turnaround/waiting/response and averages are shown. |
| Memory map | `/api/memory` | GET | None | `MemorySnapshot` | Integrated; displays actual address-ordered contiguous blocks with addresses, sizes and owner PIDs. |
| Allocate process memory | `/api/memory/allocate` | POST | `{pid,strategy}` (`FIRST_FIT`, `BEST_FIT`, `WORST_FIT`) | `{success,memory:MemorySnapshot}` | Integrated; errors such as insufficient contiguous space are surfaced from the backend. |
| Deallocate memory | `/api/memory/deallocate` | POST | `{pid}` | `{success,memory:MemorySnapshot}` | Integrated from selected allocated region; adjacent free-region coalescing is reflected from the response. |
| Process Tree | `/api/processes/tree` | GET | None | Nested root `ProcessTreeNode[]` with process fields and `children` | Integrated; reads the actual custom first-child/next-sibling hierarchy. Supports selection, expand/collapse, status badges, empty and error states. Traversal is cycle-safe. |
| Event Monitor | `/api/simulation/events` | GET | Optional `pid`, `type` | `SystemEvent[]` (`eventId`, `simulationTime`, nullable `pid`, `type`, `description`) | Integrated; renders only backend events, sorts chronologically by simulation time then event ID, and provides text/type/PID filters. |
| List saved simulations | `/api/simulations` | GET | None | `SavedSimulation[]` | Integrated; backend JSON persistence remains the source of truth. |
| Save completed simulation | `/api/simulations/save` | POST | `{name}` | `SavedSimulation` | Integrated; button is enabled only for a completed run, matching backend validation. |
| Load saved simulation | `/api/simulations/{id}` | GET | None | `SavedSimulation` including scheduling, process, memory and event snapshots | Integrated as a read-only loaded snapshot. The backend has no restore/resume route; UI labels and explains this accurately. |
| Delete saved simulation | `/api/simulations/{id}` | DELETE | None | HTTP 204 | Integrated with a confirmation dialog. |
| List/save/load/delete configurations | `/api/configurations`, `/api/configurations/{id}` | GET, POST, DELETE | Save request: `{name,algorithm,timeQuantum,preemptivePriority,totalMemory,memoryAllocationStrategy,speed}` | `SavedConfiguration[]` / `SavedConfiguration` | Integrated. Loading retrieves a configuration and transfers its supported fields into CPU Scheduler; saving appends a named JSON record. Delete uses confirmation. |
| CPU Internals history / replay | `/api/dsa/heap/runs`, `/api/dsa/heap/runs/{runId}` | GET | None | Run summaries and `HeapRunTrace` (`runId`, ordered actual heap operation steps, indexed final snapshot, truncation flag) | Integrated for SJF/Priority runs; historical read-only playback projects recorded insert/extract/update/swap indices and does not implement a JavaScript heap. At most 8 runs × 4096 steps are retained in memory; FCFS/RR have no heap trace. |
| Settings / connection | `/api/health`; `VITE_API_BASE_URL` | GET / build configuration | None | `{status, application, mode}` and Axios base URL | Integrated; health check can be refreshed, URL is shown, and default scheduler fields are saved in this browser’s local storage and applied as scheduler defaults. |

## Data and runtime notes

- `frontend/src/api/` owns HTTP calls; components do not issue Axios requests directly.
- The shell polls process, memory, simulation and event reads every 3.5 seconds. Calls are grouped, do not overlap, stop on unmount, and set the connection state only from successful API reads.
- A simulation plan is calculated by Spring. The frontend only renders the returned Gantt and metrics. The memory allocator also remains exclusively in Spring.
- Phase 3 supports one active runtime session. Process and memory changes are disabled by the UI during `RUNNING`/`PAUSED`; backend errors remain authoritative.
- Browser-local scheduler defaults use the `kernelx.defaultSchedulerConfig` local-storage key. A loaded archive configuration uses `kernelx.pendingSchedulerConfig` until Scheduler reads and consumes it.
- The backend exposes no API to restore a saved simulation snapshot into the active runtime. The Archive page retrieves and displays saved simulation data without claiming it resumes the run.
- Navigation includes working routes for all eight pages. Core four pages and their DSA/algorithm behavior were retained while later routes were added.


CPU Internals uses an interactive Three.js processor package visualization. Only the Priority Dispatch Unit is functional; other die regions are explicitly labeled future placeholders. Orbit, zoom, pan, focus and reset are client camera controls. Replay uses only backend trace steps; it is historical, never presented as a live scheduler heap.

