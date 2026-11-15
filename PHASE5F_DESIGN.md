# Phase 5F — Process Tree Visualization Unit

## Actual structure and lifecycle

The source of truth is `com.kernelx.dsa.ProcessTree`, a forest made from private nodes with `firstChild` and `nextSibling` references. `root` identifies the first root; subsequent roots are connected through `nextSibling`. A process's PCB stores `parentPid`, but tree nodes do not have parent pointers. New children attach to `firstChild` when empty or append to that child's sibling chain. Removing a process detaches it from the corresponding root/sibling/first-child link and removes its full descendant subtree. Process creation and termination retain their existing ProcessManager semantics.

## Instrumentation and diagnostics

The optional observer is called from the actual tree operations. Captured operation labels are `ROOT_INSERT`, `FIRST_CHILD_UPDATE`, `NEXT_SIBLING_UPDATE`, `SIBLING_TRAVERSAL`, `NODE_SEARCH`, `NODE_REMOVAL`, `TREE_TRAVERSAL`, and `OPERATION_COMPLETE`. Pointer steps contain actual PIDs before and after writes and logical pointer names; no physical address or binary left/right relationship is implied. `flatSnapshot()` follows the actual links iteratively with identity-based repeated-node protection, caps output at 2,048 nodes, and does not call instrumented tree operations.

`ProcessTreeTraceRecorder` retains up to 32 traces with at most 2,048 steps per trace. Traces have stable UUIDs and deterministic insertion order. History is in-memory only and clears on backend restart. Process hierarchy state itself is runtime state and is not written into JSON archive files. Snapshot, trace-list, and trace-detail reads do not record operations.

## API

- `GET /api/dsa/ptu/snapshot`: `{size, rootCount, rootPids, nodes, truncated}`; each flat node reports `nodeId` (PID as a logical identifier, never a memory address), process PID/name/state, parent PID from the PCB, first-child PID, and next-sibling PID.
- `GET /api/dsa/ptu/traces`: ordered trace summaries.
- `GET /api/dsa/ptu/traces/{traceId}`: operation steps and the final flat tree snapshot; missing IDs use standard 404 mapping.

## CPU Internals integration and replay

PTU occupies the process-hierarchy die module and has a focused camera target. The workbench shows roots, state, parent, first-child and next-sibling links, and supports selecting a node and operation, navigating backward/forward, and inspecting pointer updates. It reuses the backend tree rather than creating a TypeScript tree implementation. Playback is read-only.

The backend captures a final tree snapshot per completed operation, not a whole snapshot after each internal traversal step. Therefore replay highlights the selected actual operation and pointer delta while showing that operation's final tree. It does not claim or fabricate intermediate full-tree states.

## Verification and manual check

Run `mvn test` in `backend`; run `npm run typecheck`, `npm test`, and `npm run build` in `frontend`. For a manual check, start the backend and frontend as documented in `README.md`, create one root and multiple children in Process Manager, open CPU Internals and focus PTU, then select an INSERT or REMOVE trace and step through its recorded operations. Polling the snapshot and trace endpoints should not change history.
