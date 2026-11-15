package com.kernelx.service;

import com.kernelx.dsa.CustomHashTable;
import com.kernelx.dto.*;
import com.kernelx.model.ProcessControlBlock;
import java.time.Instant;
import java.util.*;

/** Bounded, in-memory recorder for actual PID-table operations. Snapshot methods never call the table. */
public final class AluTraceRecorder implements CustomHashTable.Observer<Integer, ProcessControlBlock> {
    private static final int MAX_TRACES = 64;
    private static final int MAX_STEPS = 2048;
    private static final int MAX_SNAPSHOT_ENTRIES = 2048;
    private static final int MAX_BUCKETS = 4096;
    private final LinkedHashMap<String, MutableTrace> traces = new LinkedHashMap<>();

    @Override public synchronized CustomHashTable.Operation<Integer, ProcessControlBlock> begin(
            String tableId, String kind, Integer key, int spreadHash, int bucketIndex, int capacity,
            CustomHashTable.BucketSnapshot<Integer, ProcessControlBlock> bucketBefore,
            CustomHashTable.Snapshot<Integer, ProcessControlBlock> tableBefore) {
        MutableTrace trace = new MutableTrace(UUID.randomUUID().toString(), tableId, kind, key, spreadHash,
                bucketIndex, Instant.now(), tableBefore == null ? null : toDto(tableBefore),
                bucketBefore == null ? null : toDto(bucketBefore));
        traces.put(trace.id, trace);
        while (traces.size() > MAX_TRACES) traces.remove(traces.keySet().iterator().next());
        return new Session(trace);
    }

    public synchronized List<AluTraceSummary> listTraces() {
        return traces.values().stream().map(t -> new AluTraceSummary(t.id, t.tableId, t.operation, t.pid,
                t.hash, t.bucket, null, t.at, t.steps.size(), t.result, t.truncated, t.description)).toList();
    }

    public synchronized Optional<AluTrace> getTrace(String id) {
        MutableTrace t = traces.get(id);
        return t == null ? Optional.empty() : Optional.of(snapshot(t));
    }

    public static AluTableSnapshot liveSnapshot(CustomHashTable.Snapshot<Integer, ProcessControlBlock> s) {
        return toDto(s);
    }

    private static AluTableSnapshot toDto(CustomHashTable.Snapshot<Integer, ProcessControlBlock> s) {
        int remaining = MAX_SNAPSHOT_ENTRIES;
        List<AluBucketSnapshot> buckets = new ArrayList<>();
        boolean truncated = s.buckets().size() > MAX_BUCKETS;
        int limit = Math.min(s.buckets().size(), MAX_BUCKETS);
        for (int i = 0; i < limit; i++) {
            var b = s.buckets().get(i);
            List<AluEntrySnapshot> entries = new ArrayList<>();
            int count = Math.min(b.entries().size(), Math.max(0, remaining));
            for (int j = 0; j < count; j++) entries.add(toDto(b.entries().get(j)));
            remaining -= count;
            boolean bucketTruncated = count < b.entries().size();
            truncated |= bucketTruncated;
            buckets.add(new AluBucketSnapshot(b.index(), b.entries().size(), entries, bucketTruncated));
        }
        return new AluTableSnapshot(s.tableId(), s.capacity(), s.size(), s.loadFactor(), buckets, truncated);
    }

    private static AluBucketSnapshot toDto(CustomHashTable.BucketSnapshot<Integer, ProcessControlBlock> b) {
        List<AluEntrySnapshot> entries = b.entries().stream().limit(MAX_SNAPSHOT_ENTRIES).map(AluTraceRecorder::toDto).toList();
        return new AluBucketSnapshot(b.index(), b.entries().size(), entries, entries.size() < b.entries().size());
    }

    private static AluEntrySnapshot toDto(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e) {
        ProcessControlBlock p = e.value();
        return new AluEntrySnapshot(e.nodeId(), e.key(), p.getName(), p.getState(), p.getPriority(), p.getArrivalTime(),
                p.getBurstTime(), p.getRemainingTime(), p.getMemoryRequirement(), p.getParentPid(), p.getCompletionTime(),
                p.getWaitingTime(), p.getTurnaroundTime(), p.getResponseTime(), e.nextNodeId());
    }

    private synchronized void add(MutableTrace t, AluTraceStep step) {
        if (t.steps.size() >= MAX_STEPS) { t.truncated = true; return; }
        t.steps.add(new AluTraceStep(t.steps.size() + 1L, step.kind(), step.pid(), step.entryId(), step.bucketIndex(),
                step.oldBucketIndex(), step.newBucketIndex(), step.chainPosition(), step.collisionChainLength(),
                step.spreadHash(), step.oldCapacity(), step.newCapacity(), step.ownerEntryId(), step.oldNextEntryId(),
                step.newNextEntryId(), step.oldBucketHeadEntryId(), step.newBucketHeadEntryId(), step.result(),
                step.entry(), step.description()));
    }

    private AluTrace snapshot(MutableTrace t) {
        return new AluTrace(t.id, t.tableId, t.operation, t.pid, t.hash, t.bucket, null, t.at,
                t.before, t.after, t.bucketBefore, t.bucketAfter, t.steps, t.result, t.truncated, t.description);
    }

    private final class Session implements CustomHashTable.Operation<Integer, ProcessControlBlock> {
        private final MutableTrace t;
        Session(MutableTrace t) { this.t = t; }
        private void step(String kind, Long entryId, Integer bucket, Integer oldBucket, Integer newBucket,
                          Integer position, Integer collisionLength, Integer oldCap, Integer newCap, Long owner,
                          Long oldNext, Long newNext, Long oldHead, Long newHead, Boolean result,
                          AluEntrySnapshot entry, String description) {
            add(t, new AluTraceStep(0, kind, t.pid, entryId, bucket, oldBucket, newBucket, position,
                    collisionLength, t.hash, oldCap, newCap, owner, oldNext, newNext, oldHead, newHead,
                    result, entry, description));
        }
        @Override public void nodeVisited(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e, int b, int p) {
            step("NODE_VISITED", e.nodeId(), b, null, null, p, null, null, null, null, null, null, null, null, null, toDto(e), "Visited chain entry at position " + p);
        }
        @Override public void keyCompared(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e, int b, int p, boolean matched) {
            step("KEY_COMPARED", e.nodeId(), b, null, null, p, null, null, null, null, null, null, null, null, matched, toDto(e), matched ? "PID matched" : "PID did not match");
        }
        @Override public void collision(int b, int length, int position, int hash) {
            step("COLLISION", null, b, null, null, position, length, null, null, null, null, null, null, null, null, null, "Distinct PID mapped to occupied bucket; chain length " + length);
        }
        @Override public void nodeCreated(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e, int b, int p) {
            step("NODE_CREATED", e.nodeId(), b, null, null, p, null, null, null, null, null, null, null, null, null, toDto(e), "Created new table entry");
        }
        @Override public void bucketHeadUpdated(int b, Long oldHead, Long newHead) {
            step("BUCKET_HEAD_UPDATED", newHead, b, null, null, null, null, null, null, null, null, null, oldHead, newHead, null, null, "Updated bucket head link");
        }
        @Override public void nextPointerUpdated(long owner, int b, int p, Long oldNext, Long newNext) {
            step("NEXT_POINTER_UPDATED", owner, b, null, null, p, null, null, null, owner, oldNext, newNext, null, null, null, null, "Updated chain next link");
        }
        @Override public void valueReplaced(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e, ProcessControlBlock old) {
            step("VALUE_REPLACED", e.nodeId(), t.bucket, null, null, null, null, null, null, null, null, null, null, null, null, toDto(e), "Replaced value for existing PID");
        }
        @Override public void entryRemoved(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e, int b, int p) {
            step("ENTRY_REMOVED", e.nodeId(), b, null, null, p, null, null, null, null, null, null, null, null, null, toDto(e), "Unlinked entry from chain");
        }
        @Override public void resizeStarted(int oldCapacity, int newCapacity, int size) {
            step("RESIZE_STARTED", null, null, null, null, null, null, oldCapacity, newCapacity, null, null, null, null, null, null, null, "Load factor exceeded 0.75; rehashing " + size + " entries");
        }
        @Override public void rehashed(CustomHashTable.EntrySnapshot<Integer, ProcessControlBlock> e, int oldB, int newB,
                                       Long oldNext, Long newNext, Long oldHead, Long newHead) {
            step("ENTRY_REHASHED", e.nodeId(), newB, oldB, newB, null, null, null, null, e.nodeId(), oldNext, newNext, oldHead, newHead, null, toDto(e), "Moved entry from bucket " + oldB + " to " + newB);
        }
        @Override public void resizeCompleted(CustomHashTable.Snapshot<Integer, ProcessControlBlock> result) {
            step("RESIZE_COMPLETED", null, null, null, null, null, null, null, result.capacity(), null, null, null, null, null, null, null, "Rehash completed at capacity " + result.capacity());
        }
        @Override public void completed(boolean found, String description,
                                        CustomHashTable.BucketSnapshot<Integer, ProcessControlBlock> bucketAfter,
                                        CustomHashTable.Snapshot<Integer, ProcessControlBlock> tableAfter) {
            t.result = found; t.description = description;
            t.bucketAfter = bucketAfter == null ? null : toDto(bucketAfter);
            t.after = tableAfter == null ? null : toDto(tableAfter);
            step("OPERATION_COMPLETED", null, t.bucket, null, null, null, null, null, null, null, null, null, null, null, found, null, description);
        }
    }

    private static final class MutableTrace {
        final String id, tableId, operation; final Integer pid, hash, bucket; final Instant at;
        final AluTableSnapshot before; final AluBucketSnapshot bucketBefore; final List<AluTraceStep> steps = new ArrayList<>();
        AluTableSnapshot after; AluBucketSnapshot bucketAfter; Boolean result; boolean truncated; String description = "Operation started";
        MutableTrace(String id, String tableId, String operation, Integer pid, Integer hash, Integer bucket, Instant at,
                     AluTableSnapshot before, AluBucketSnapshot bucketBefore) {
            this.id=id; this.tableId=tableId; this.operation=operation; this.pid=pid; this.hash=hash; this.bucket=bucket; this.at=at;
            this.before=before; this.bucketBefore=bucketBefore;
        }
    }
}
