package com.kernelx.service;

import com.kernelx.dto.HeapEntrySnapshot;
import com.kernelx.dto.HeapRunSummary;
import com.kernelx.dto.HeapRunTrace;
import com.kernelx.dto.HeapSlotSnapshot;
import com.kernelx.dto.HeapTraceStep;
import com.kernelx.model.SchedulingAlgorithm;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Bounded, in-memory history of actual scheduler heap operations; independent of JSON event persistence. */
public final class HeapTraceRecorder {
    private static final int MAX_RUNS = 8;
    private static final int MAX_STEPS_PER_RUN = 4096;
    private final LinkedHashMap<String, MutableRun> runs = new LinkedHashMap<>();

    public synchronized RunSession beginRun(SchedulingAlgorithm algorithm, boolean preemptive, int processCount) {
        MutableRun run = new MutableRun(UUID.randomUUID().toString(), algorithm.name(), preemptive, processCount, Instant.now());
        runs.put(run.runId, run);
        while (runs.size() > MAX_RUNS) runs.remove(runs.keySet().iterator().next());
        return new RunSession(run.runId);
    }

    public synchronized List<HeapRunSummary> listRuns() {
        List<HeapRunSummary> result = new ArrayList<>(runs.size());
        for (MutableRun run : runs.values()) result.add(summary(run));
        return List.copyOf(result);
    }

    public synchronized Optional<HeapRunTrace> getRun(String runId) {
        MutableRun run = runs.get(runId);
        if (run == null) return Optional.empty();
        return Optional.of(snapshot(run));
    }

    private synchronized void add(String runId, StepData data) {
        MutableRun run = runs.get(runId);
        if (run == null || run.completedAt != null) return;
        if (run.steps.size() >= MAX_STEPS_PER_RUN) { run.truncated = true; return; }
        run.steps.add(new HeapTraceStep(run.steps.size() + 1L, data.kind, data.simulationTime,
                data.pid, data.name, data.priority, data.index, data.otherIndex, data.comparisonResult,
                data.comparisonPhase, data.value, data.otherValue, data.values, data.sizeBefore, data.sizeAfter));
    }

    private synchronized void complete(String runId, List<HeapEntrySnapshot> entries) {
        MutableRun run = runs.get(runId);
        if (run == null || run.completedAt != null) return;
        List<HeapSlotSnapshot> slots = new ArrayList<>(entries.size());
        for (int index = 0; index < entries.size(); index++) slots.add(new HeapSlotSnapshot(index, entries.get(index)));
        run.finalHeap = List.copyOf(slots);
        run.completedAt = Instant.now();
    }

    private HeapRunSummary summary(MutableRun run) {
        return new HeapRunSummary(run.runId, run.algorithm, run.preemptive, run.processCount,
                run.startedAt, run.completedAt, run.steps.size(), run.truncated);
    }

    private HeapRunTrace snapshot(MutableRun run) {
        return new HeapRunTrace(run.runId, run.algorithm, run.preemptive, run.processCount,
                run.startedAt, run.completedAt, run.finalHeap, run.steps, run.truncated);
    }

    private static final class MutableRun {
        private final String runId, algorithm;
        private final boolean preemptive;
        private final int processCount;
        private final Instant startedAt;
        private final List<HeapTraceStep> steps = new ArrayList<>();
        private List<HeapSlotSnapshot> finalHeap = List.of();
        private Instant completedAt;
        private boolean truncated;
        private MutableRun(String runId, String algorithm, boolean preemptive, int processCount, Instant startedAt) {
            this.runId = runId; this.algorithm = algorithm; this.preemptive = preemptive;
            this.processCount = processCount; this.startedAt = startedAt;
        }
    }

    private record StepData(String kind, int simulationTime, Integer pid, String name, Integer priority,
                            Integer index, Integer otherIndex, Integer comparisonResult, String comparisonPhase,
                            HeapEntrySnapshot value, HeapEntrySnapshot otherValue, List<HeapEntrySnapshot> values,
                            Integer sizeBefore, Integer sizeAfter) { }

    public final class RunSession {
        private final String runId;
        private int simulationTime;
        private RunSession(String runId) { this.runId = runId; }
        public String runId() { return runId; }
        public void setSimulationTime(int value) { simulationTime = value; }
        public void heapify(List<HeapEntrySnapshot> values) { add(runId, data("HEAPIFY", null, null, null, null, null, null, values, values.size(), values.size())); }
        public void insert(HeapEntrySnapshot value, int index, int sizeBefore) { add(runId, data("INSERT", value, null, index, null, null, null, List.of(), sizeBefore, sizeBefore + 1)); }
        public void extract(HeapEntrySnapshot maximum, HeapEntrySnapshot replacement, int sizeBefore) { add(runId, data("EXTRACT_MAX", maximum, replacement, 0, sizeBefore - 1, null, null, List.of(), sizeBefore, sizeBefore - 1)); }
        public void update(HeapEntrySnapshot previous, HeapEntrySnapshot replacement, int index) { add(runId, data("UPDATE", previous, replacement, index, null, null, null, List.of(), null, null)); }
        public void compare(int leftIndex, HeapEntrySnapshot left, int rightIndex, HeapEntrySnapshot right, int result, String phase) { add(runId, data("COMPARE", left, right, leftIndex, rightIndex, result, phase, List.of(), null, null)); }
        public void swap(int leftIndex, HeapEntrySnapshot left, int rightIndex, HeapEntrySnapshot right) { add(runId, data("SWAP", left, right, leftIndex, rightIndex, null, null, List.of(), null, null)); }
        public void complete(List<HeapEntrySnapshot> entries) { HeapTraceRecorder.this.complete(runId, entries); }
        private StepData data(String kind, HeapEntrySnapshot value, HeapEntrySnapshot other,
                              Integer index, Integer otherIndex, Integer comparison, String phase,
                              List<HeapEntrySnapshot> values, Integer before, Integer after) {
            return new StepData(kind, simulationTime, value == null ? null : value.pid(),
                    value == null ? null : value.name(), value == null ? null : value.priority(),
                    index, otherIndex, comparison, phase, value, other, values, before, after);
        }
    }
}
