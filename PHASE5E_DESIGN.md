# Phase 5E — FIFO Process Buffer design

Status: recorded before implementation.

## Existing queue architecture

- `CustomQueue<T>` is a manually linked singly linked FIFO with `head`, `tail`, and `size`. `enqueue` appends at the tail in O(1); `dequeue` removes the head in O(1), and clears the tail when the queue becomes empty. `peek`, `isEmpty`, `size`, `traverse`, and `display` exist; the scheduler uses enqueue/dequeue/peek/isEmpty only.
- Production usages are deliberately separate. `EventManager` owns `CustomQueue<SystemEvent>` for persisted event history; that infrastructure queue is not scheduler activity and will keep the default no-op observer. `SchedulingService.FifoReady` creates the scheduler queue for FCFS and Round Robin. SJF and Priority use `MaxHeap` and must not produce FPB traces.
- The FIFO queue is created inside a synchronous scheduling plan and discarded after the plan is calculated. `SimulationEngine.start()` calls `SchedulingService.schedule()` once. There is no exposed in-progress scheduler queue; simulation ticks consume the already-computed Gantt plan. Thus FPB has historical run traces, while its live snapshot reports inactive with no queue.
- Round Robin adds newly arrived work at the rear and re-enqueues an expired process at the rear only when it has remaining work (the existing loop already enforces this). FCFS only enqueues arrivals and dequeues the front. These operations and their order are not changed.

## Instrumentation plan

Add a no-op-default observer to the existing `CustomQueue`, invoked only immediately after real enqueue/dequeue pointer changes. Give each queue a stable UUID and its linked nodes monotonic logical IDs. A direct immutable queue snapshot walks the actual links and does not call observer methods. Default `EventManager` queues have no-op observation.

Only a real `FifoReady` instance receives a run-scoped observer. A run session is created for FCFS or Round Robin at scheduling invocation and includes a UUID scheduling-run ID, algorithm, process count, start/end instants, and a distinct trace ID. Each actual queue callback records the operation, process snapshot, size before/after, old/new front and rear IDs, and the actual ordered after-state snapshot. Replay uses those immutable after-state snapshots and never runs the scheduler again. No active queue is retained after the scheduling method returns.

Trace retention is bounded to 16 runs, 2,048 recorded operations per run, 512 nodes per individual snapshot, and 32,768 node snapshots total per run. Operation count still reflects all actual queue mutations after the recorded prefix is full; truncation flags mark omitted records/data. Recorder writes are synchronized; trace API reads return immutable snapshots without touching any queue.

## API contract

- `GET /api/dsa/fpb/snapshot`: `{active:false, queue:null, message:...}` in the current synchronous architecture; no fictitious live queue.
- `GET /api/dsa/fpb/traces`: recent FCFS/Round Robin trace summaries with trace ID, scheduling-run ID, algorithm, process count, operation count, timestamps, completion and truncation metadata.
- `GET /api/dsa/fpb/traces/{traceId}`: one completed historical trace with initial queue state and ordered operation steps; unknown/evicted ID returns the existing standard 404 API error.

Trace history is in memory only and resets at backend restart. The event queue is not included. SJF/Priority produce no FIFO traces.

## Frontend plan

Add a CPU Internals Queue Unit and workbench backed only by FPB DTOs. Show the inactive live status separately from selected historical run state. The historical view renders the recorded ordered nodes, FRONT/REAR, step details, and queue size; reset/previous/next/play only select recorded snapshots. Integrate a compact queue region in the existing processor die and focused camera target; keep empty, loading and error states and the existing graphite/off-white/yellow palette.

## Test plan

- Custom queue tests capture actual head/tail/node-link transitions and verify no-op/default behavior, empty queue semantics and read-only snapshots.
- Scheduler tests verify FCFS and Round Robin actual operation ordering and queue snapshots, RR rear re-enqueue, distinct run IDs, unchanged Gantt/metrics, and no SJF/Priority FIFO records.
- Isolated API tests verify inactive snapshots, repeated snapshot/list/detail reads do not add operations, invalid IDs return 404, and traces are run-associated. EventManager queue use must not enter FPB history.
- Frontend tests cover inactive/empty state, actual trace snapshots, selection and replay navigation/playback, and API failures without local queue simulation.
