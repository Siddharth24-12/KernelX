package com.kernelx.service;

import com.kernelx.dsa.CustomQueue;
import com.kernelx.dto.*;
import com.kernelx.model.SchedulingAlgorithm;
import java.time.Instant;
import java.util.*;

/** Bounded historical snapshots of the scheduler's actual ephemeral FIFO queues. */
public final class FpbTraceRecorder {
    private static final int MAX_RUNS = 16;
    private static final int MAX_STEPS_PER_RUN = 2048;
    private static final int MAX_NODES_PER_SNAPSHOT = 512;
    private static final int MAX_SNAPSHOT_NODES_PER_RUN = 32_768;
    private final LinkedHashMap<String, MutableRun> runs = new LinkedHashMap<>();

    public synchronized RunSession beginRun(SchedulingAlgorithm algorithm, int processCount) {
        if (algorithm != SchedulingAlgorithm.FCFS && algorithm != SchedulingAlgorithm.ROUND_ROBIN) {
            throw new IllegalArgumentException("FIFO traces are available only for FCFS and Round Robin");
        }
        MutableRun run = new MutableRun(UUID.randomUUID().toString(), UUID.randomUUID().toString(), algorithm.name(), processCount, Instant.now());
        runs.put(run.traceId, run);
        while (runs.size() > MAX_RUNS) runs.remove(runs.keySet().iterator().next());
        return new RunSession(run);
    }

    public synchronized FpbLiveSnapshot liveSnapshot() {
        return new FpbLiveSnapshot(false, null, "Scheduler queues are temporary and no active queue is exposed. Select a completed FCFS or Round Robin trace to inspect historical queue state.");
    }

    public synchronized List<FpbTraceSummary> listTraces() {
        return runs.values().stream().filter(run -> run.completedAt != null).map(this::summary).toList();
    }
    public synchronized Optional<FpbTrace> getTrace(String traceId) {
        MutableRun run = runs.get(traceId);
        return run == null || run.completedAt == null ? Optional.empty() : Optional.of(snapshot(run));
    }

    private synchronized void initial(MutableRun run, CustomQueue.Snapshot<SchedulingService.Work> state) {
        if (run.initialQueue == null) { run.queueId = state.queueId(); run.initialQueue = toDto(state, run); }
    }
    private synchronized void record(MutableRun run, String operation, long nodeId, SchedulingService.Work work,
                                     int sizeBefore, Long frontBefore, Long rearBefore,
                                     CustomQueue.Snapshot<SchedulingService.Work> state) {
        if (run.completedAt != null) return;
        run.totalOperations++;
        if (run.steps.size() >= MAX_STEPS_PER_RUN) { run.truncated = true; return; }
        FpbQueueSnapshot after = toDto(state, run);
        FpbProcessSnapshot process = work.fpbSnapshot();
        run.steps.add(new FpbTraceStep(run.steps.size() + 1L, operation, process.pid(), sizeBefore, state.size(),
                frontBefore, state.frontNodeId(), rearBefore, state.rearNodeId(), process, after,
                operation.equals("ENQUEUE") ? "P" + process.pid() + " entered at the rear of the FIFO queue"
                        : "P" + process.pid() + " left from the front of the FIFO queue"));
        run.truncated |= after.truncated();
    }
    private synchronized void complete(MutableRun run, CustomQueue.Snapshot<SchedulingService.Work> state) {
        if (run.completedAt != null) return;
        if (run.initialQueue == null) run.initialQueue = toDto(state, run);
        run.finalQueue = toDto(state, run);
        run.truncated |= run.finalQueue.truncated();
        run.completedAt = Instant.now();
    }

    private FpbQueueSnapshot toDto(CustomQueue.Snapshot<SchedulingService.Work> state, MutableRun run) {
        List<FpbQueueNodeSnapshot> nodes = new ArrayList<>();
        int count = Math.min(state.nodes().size(), MAX_NODES_PER_SNAPSHOT);
        count = Math.min(count, Math.max(0, MAX_SNAPSHOT_NODES_PER_RUN - run.snapshotNodesStored));
        for (int index = 0; index < count; index++) {
            var node = state.nodes().get(index);
            nodes.add(new FpbQueueNodeSnapshot(node.nodeId(), node.value().fpbSnapshot(), node.nextNodeId()));
        }
        boolean truncated = state.truncated() || count < state.nodes().size();
        run.snapshotNodesStored += count;
        run.truncated |= truncated;
        return new FpbQueueSnapshot(state.queueId(), state.size(), state.frontNodeId(), state.rearNodeId(), nodes, truncated);
    }
    private FpbTraceSummary summary(MutableRun run) {
        return new FpbTraceSummary(run.traceId, run.schedulingRunId, run.queueId, run.algorithm, run.processCount,
                run.totalOperations, run.startedAt, run.completedAt, run.completedAt != null, run.truncated);
    }
    private FpbTrace snapshot(MutableRun run) {
        return new FpbTrace(run.traceId, run.schedulingRunId, run.queueId, run.algorithm, run.processCount,
                run.totalOperations, run.startedAt, run.completedAt, run.completedAt != null, run.truncated,
                run.initialQueue, run.finalQueue, run.steps);
    }

    public final class RunSession implements CustomQueue.Observer<SchedulingService.Work> {
        private final MutableRun run;
        private RunSession(MutableRun run) { this.run = run; }
        public String traceId() { return run.traceId; }
        public String schedulingRunId() { return run.schedulingRunId; }
        @Override public int maxSnapshotNodes() {
            synchronized (FpbTraceRecorder.this) {
                return run.steps.size() >= MAX_STEPS_PER_RUN ? 0
                        : Math.min(MAX_NODES_PER_SNAPSHOT, Math.max(0, MAX_SNAPSHOT_NODES_PER_RUN - run.snapshotNodesStored));
            }
        }
        public void beginQueue(CustomQueue.Snapshot<SchedulingService.Work> state) { initial(run, state); }
        @Override public void enqueued(long nodeId, SchedulingService.Work value, int sizeBefore, Long frontBefore,
                                       Long rearBefore, CustomQueue.Snapshot<SchedulingService.Work> after) {
            record(run, "ENQUEUE", nodeId, value, sizeBefore, frontBefore, rearBefore, after);
        }
        @Override public void dequeued(long nodeId, SchedulingService.Work value, int sizeBefore, Long frontBefore,
                                       Long rearBefore, CustomQueue.Snapshot<SchedulingService.Work> after) {
            record(run, "DEQUEUE", nodeId, value, sizeBefore, frontBefore, rearBefore, after);
        }
        public void complete(CustomQueue.Snapshot<SchedulingService.Work> state) { FpbTraceRecorder.this.complete(run, state); }
    }

    private static final class MutableRun {
        final String traceId, schedulingRunId, algorithm; final int processCount; final Instant startedAt;
        String queueId; int totalOperations; int snapshotNodesStored; boolean truncated; Instant completedAt;
        FpbQueueSnapshot initialQueue, finalQueue; final List<FpbTraceStep> steps = new ArrayList<>();
        MutableRun(String traceId, String schedulingRunId, String algorithm, int processCount, Instant startedAt) {
            this.traceId = traceId; this.schedulingRunId = schedulingRunId; this.algorithm = algorithm;
            this.processCount = processCount; this.startedAt = startedAt;
        }
    }
}
