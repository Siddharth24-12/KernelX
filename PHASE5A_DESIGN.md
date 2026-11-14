# Phase 5A — CPU internals instrumentation design

Status: inspection and design only. No DSA algorithm, scheduling behavior, or runtime endpoint has been changed in this stage.

## Existing structure map

| Structure | Current owner and use | Truth available today | Instrumentation requirement |
|---|---|---|---|
| `MaxHeap<Work>` | Short-lived local instance in `SchedulingService.HeapReady`; used by SJF and Priority during schedule calculation | Generic heap stores array positions; comparator determines actual ordering. Insert, extract, update, `siftUp`, `siftDown`, comparisons, and swaps are real implementation steps. It is discarded after `schedule()` returns. | Optional no-op-by-default observer at the actual comparison/swap/insert/extract points; a read-only indexed snapshot; caller context for algorithm and simulation tick. Keep the comparator and operation order unchanged. |
| `CustomHashTable<Integer, ProcessControlBlock>` | Long-lived `ProcessManager.byPid` index | Capacity, size, separate chains, exact hash spread (`hashCode`, xor with upper 16 bits), bucket mask, head insertion, collision traversal, and resize/rehash are all available internally. | Snapshot bucket chains without calling `get`; report actual key hash/bucket values from instrumented operations; record actual collision visits and rehash destinations. |
| `ProcessLinkedList` | Long-lived ordered PCB registry in `ProcessManager` | Actual head/tail and successor links, insertion order, traversals, removal and pointer rewrites. No physical addresses exist. | Snapshot the ordered records and stable node IDs. Display stable IDs as logical handles, never as memory addresses. Emit pointer-change steps only from the actual insert/remove operations. |
| `CustomQueue<T>` | Scheduler FIFO ready set for FCFS/Round Robin, and separately the persistent `EventManager` history | Actual FIFO head/tail behavior, enqueue/dequeue/peek and ordering. Scheduler queues are local to each scheduling calculation; event queue has a different purpose and lifecycle. | Keep the two queue instances/lifecycles distinguishable. Trace scheduler queue operations with scheduling context. Do not represent event-history appends as ready-buffer enqueues. |
| `ProcessTree` | Long-lived first-child/next-sibling hierarchy in `ProcessManager` | Actual root/child/sibling links and process fields. The read-only `/api/processes/tree` endpoint returns nested child relationships but not link IDs. | Extend the diagnostic snapshot to include explicit first-child and next-sibling relationships, without replacing the custom links or mutating them. Reuse cycle protection. |

`MemoryManager` is also a custom linked list of simulated-address blocks. It can be represented as the memory-controller region using its existing `MemorySnapshot`; its reported addresses are simulated addresses and are safe to label as such. It is not one of the five DSA structures listed above.

## Proposed instrumentation boundary

1. Add small observer interfaces to the existing structures. Existing constructors keep a no-op observer by default, so current unit tests and algorithm callers retain the same behavior. Observer callbacks run synchronously at the real pointer, comparison, bucket, or swap operation.
2. Add a thread-safe in-memory trace recorder, separate from `SystemEvent` persistence. Keep a fixed maximum history (initial proposal: 512 records), monotonically increasing sequence IDs, and bounded response page size (maximum 100). Eviction is oldest-first and never touches the JSON event/archive files.
3. Trace entries use immutable DTOs: sequence, structure, operation, PID/key when present, simulation tick only when the caller has a real tick, component/slot identifiers, and actual before/after values or intermediate steps. Unknown addresses, hashes, swaps, and queue orderings are omitted rather than inferred.
4. Observer context is supplied by the operation owner. For scheduler heap/queue callbacks this includes algorithm, PID, and the simulation time used by `SchedulingService.run`. Process-manager operations supply operation/PID context. A lookup trace may carry a hash only when the hash table itself calculated it.
5. Diagnostic snapshot reads inspect internal links/arrays directly and do not call mutating operations or emit trace entries. Trace reads only read the recorder. Proposed API boundary: `GET /api/dsa/snapshot` and `GET /api/dsa/operations?afterSequence=&limit=`. The second response reports the newest sequence and whether older entries were evicted.
6. Keep details proportional to the work performed and cap any returned collection. The frontend animates these recorded steps; it does not calculate a parallel heap, hash function, queue order, or pointer update.

## Staged implementation gate

- **5A (this stage):** inspect and agree on structure ownership, trace boundaries, read-only diagnostics, and limits.
- **5B:** instrument the actual scheduler heap; add its snapshot/trace API; build the processor die overview and Priority Dispatch Unit around actual heap state and steps.
- **5C:** instrument the real PID hash table, including collision and resize/re-hash steps; build the Associative Lookup Unit.
- **5D:** instrument the real process linked list and scheduler FIFO queue; build their descriptor memory and buffer views.
- **5E:** expose the actual first-child/next-sibling links and complete camera/subsystem integration.

Each stage will be separately tested and built, then held for review before the next stage begins. No Phase 6 work is included.

## Phase 5A verification

This stage changes no runtime source. Run the existing backend and frontend suites/build as a baseline before proceeding to 5B. Visual review applies after the 3D scene is implemented; this design-only stage has no new screen to capture.
