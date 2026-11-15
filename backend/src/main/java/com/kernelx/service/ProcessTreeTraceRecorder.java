package com.kernelx.service;

import com.kernelx.dto.*;
import com.kernelx.dsa.ProcessTree;
import java.util.*;

/** Bounded, in-memory recorder for actual ProcessTree operations. */
public final class ProcessTreeTraceRecorder {
    private static final int MAX_TRACES = 32, MAX_STEPS = 2048;
    private final LinkedHashMap<String, PtuTrace> traces = new LinkedHashMap<>();
    public synchronized void record(ProcessTree.TraceData data) {
        List<PtuTraceStep> steps = new ArrayList<>();
        for (int i = 0; i < Math.min(data.steps().size(), MAX_STEPS); i++) {
            var s = data.steps().get(i);
            steps.add(new PtuTraceStep(i + 1L, s.operation(), s.currentPid(), s.parentPid(), s.firstChildBefore(), s.firstChildAfter(), s.nextSiblingBefore(), s.nextSiblingAfter(), s.visitedPid(), s.pointerChange(), s.pointerBeforePid(), s.pointerAfterPid(), s.description()));
        }
        List<PtuNodeSnapshot> nodes = data.finalTree().stream().map(n -> new PtuNodeSnapshot(n.pid(), n.pid(), n.name(), n.state(), n.parentPid(), n.firstChildPid(), n.nextSiblingPid())).toList();
        traces.put(data.traceId(), new PtuTrace(data.traceId(), data.operation(), data.targetPid(), data.recordedAt(), nodes, steps, data.truncated() || data.steps().size() > MAX_STEPS));
        while (traces.size() > MAX_TRACES) traces.remove(traces.keySet().iterator().next());
    }
    public synchronized List<PtuTraceSummary> list() { return traces.values().stream().map(t -> new PtuTraceSummary(t.traceId(), t.operation(), t.targetPid(), t.recordedAt(), t.steps().size(), t.truncated())).toList(); }
    public synchronized Optional<PtuTrace> get(String id) { return Optional.ofNullable(traces.get(id)); }
}
