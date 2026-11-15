# Phase 5D — Associative Lookup Unit design

Status: design recorded before implementation. This phase adds instrumentation and the ALU visualization around the existing `CustomHashTable`; it does not replace the table or modify scheduler, memory, PMU, PDU, or persistence behavior.

## Existing implementation

- `CustomHashTable<K,V>` stores private singly linked `Node` chains in a `Node[]` bucket array. Each node contains a key, value, and `next` reference.
- Default capacity is 16. A requested positive capacity is rounded up to the next power of two. Capacity doubles when a new insertion makes `size / capacity > 0.75`.
- The index function starts with `key.hashCode()`, spreads high bits with `hash ^= hash >>> 16`, then uses `hash & (capacity - 1)`. Capacity being a power of two makes the mask the bucket calculation.
- Collision resolution is separate chaining. New keys are inserted at the bucket head. Existing keys are replaced in place without changing size or chain links.
- Rehashing walks old buckets in ascending index order and each chain from its current head. Each existing node is relinked at the head of its new bucket. This preserves the implementation's actual iteration and chain-reversal behavior.
- `ProcessManager.byPid` is this custom table keyed by integer PID. It calls `get` for duplicate and parent checks, process retrieval and state operations, and descendant checks; `put` when a process is created; and `remove` for terminated processes. `/api/processes` and app-shell polling use the process-list snapshot and must not call `byPid.get`.
- Before this phase, the table has no observers or snapshot API. Its public size/capacity accessors do not expose buckets. Existing PDU and PMU recorders are bounded, in-memory observers; their diagnostic endpoints read recorder state without adding operation records.

## Instrumentation boundary

Add a no-op-by-default observer to the existing generic table, with callbacks at the current hash calculation, bucket selection, chain visits/comparisons, head insertion, unlink, replacement, and actual resize/relink sites. Do not call `get` from `put`, and do not add any extra DSA mutations for observation. Keep the current operation order and return values.

Use a stable table UUID and monotonically allocated logical node IDs, which remain stable while nodes are rehashed. IDs are labels for software entries, not hardware addresses. Actual spread hash, bucket, chain position, collision and resize data are passed from the table at the point calculated or changed; the UI must not recalculate them.

Capture lookup traces as the actual visited chain and comparisons, with the affected historical bucket chain; avoid copying the whole table for every ordinary `get`. Capture full before/after table snapshots for writes, including resize/rehash, so historical mutation replay can use recorded data. Cap trace count, steps and historical snapshot entries. Live snapshots walk buckets directly without invoking observer callbacks. Trace reads only read the recorder.

## Snapshot and trace API contract

- `GET /api/dsa/alu/snapshot`: table ID, capacity, size, load factor and every bucket in index order (including empty buckets), with actual ordered entries and next-node links. Entry DTOs contain copied PCB fields, never mutable `ProcessControlBlock` instances.
- `GET /api/dsa/alu/traces`: bounded recent trace summaries.
- `GET /api/dsa/alu/traces/{traceId}`: one immutable actual operation trace, or the standard 404 response when absent/evicted.
- `GET` endpoints, frontend polling, manual refresh and replay do not call instrumented hash-table operations. Trace retention is in-memory and resets at backend restart; traces are not written to JSON persistence.

Trace steps cover actual bucket/chain visits and comparisons, a collision only after an unsuccessful key search finds a non-empty target bucket, actual insert/replace/remove and pointer changes, and resize/re-hash callbacks for each node that actually moves. Rehash records old/new bucket and link targets and the final captured distribution. Optional simulation time remains null unless a caller supplies a real simulation tick.

## Frontend design

Replace the processor-die ALU placeholder with a compact bucket-bank region in the existing Three.js scene. Render a small overview of actual buckets and occupancy, and expand the camera focus to the ALU for a readable table view. The page-level inspector presents exact capacity/load data, selectable bucket chains and bounded operation replay. Replay projects backend snapshots and steps without implementing a frontend hash table. Empty, loading and error states remain explicit. Graphite/off-white stay dominant; yellow marks only the active bucket/entry and real collision or rehash state.

## Testing strategy

- DSA unit tests derive deterministic collisions and resize thresholds from this table's hash/index/capacity rules, then assert bucket chains, trace step order, pointer changes, resize movement, and lookup correctness.
- Recorder tests cover bounds and that direct snapshots do not add traces.
- Isolated Spring integration tests use a temporary data directory and exercise all ALU GET endpoints, process creation/lookup/termination, polling-style repeated reads, collision/resize evidence, stable live state, and historical trace reads.
- Frontend tests cover empty/populated bucket rendering, chain order, selection, trace projection/read-only replay, errors/retry, and no client-side hash derivation.
- The existing heap trace integration test remains the regression guard for PDU; the existing PMU integration test remains the guard for PMU.
