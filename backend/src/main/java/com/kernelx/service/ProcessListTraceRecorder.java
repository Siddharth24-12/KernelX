package com.kernelx.service;

import com.kernelx.dsa.ProcessLinkedList;
import com.kernelx.dto.PmuListSnapshot;
import com.kernelx.dto.PmuNodeSnapshot;
import com.kernelx.dto.PmuTrace;
import com.kernelx.dto.PmuTraceStep;
import com.kernelx.dto.PmuTraceSummary;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Bounded in-memory record of actual ProcessLinkedList operations, independent of JSON persistence. */
public final class ProcessListTraceRecorder implements ProcessLinkedList.Observer {
    private static final int MAX_TRACES = 32;
    private static final int MAX_STEPS_PER_TRACE = 1024;
    private static final int MAX_RECORDED_NODES_PER_SNAPSHOT = 2048;
    private final LinkedHashMap<String, MutableTrace> traces = new LinkedHashMap<>();

    @Override
    public synchronized ProcessLinkedList.Operation begin(String kind, Integer targetPid, ProcessLinkedList.Snapshot before) {
        MutableTrace trace = new MutableTrace(UUID.randomUUID().toString(), before.listId(), kind, targetPid,
                null, snapshot(before, MAX_RECORDED_NODES_PER_SNAPSHOT), Instant.now());
        traces.put(trace.traceId, trace);
        while (traces.size() > MAX_TRACES) traces.remove(traces.keySet().iterator().next());
        return new TraceOperation(trace.traceId);
    }

    public synchronized List<PmuTraceSummary> listTraces() {
        List<PmuTraceSummary> result = new ArrayList<>(traces.size());
        for (MutableTrace trace : traces.values()) result.add(summary(trace));
        return List.copyOf(result);
    }

    public synchronized Optional<PmuTrace> getTrace(String traceId) {
        MutableTrace trace = traces.get(traceId);
        if (trace == null) return Optional.empty();
        return Optional.of(new PmuTrace(trace.traceId, trace.listId, trace.operation, trace.targetPid,
                trace.simulationTime, trace.beforeSnapshot, trace.afterSnapshot, trace.steps,
                trace.result, trace.truncated, trace.description));
    }

    /** Converts a direct DSA snapshot without calling instrumented traversal/search methods. */
    public static PmuListSnapshot liveSnapshot(ProcessLinkedList.Snapshot source) {
        return snapshot(source, Integer.MAX_VALUE);
    }

    private static PmuListSnapshot snapshot(ProcessLinkedList.Snapshot source, int limit) {
        int count = Math.min(source.nodes().size(), limit);
        List<PmuNodeSnapshot> nodes = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            ProcessLinkedList.NodeSnapshot node = source.nodes().get(i);
            nodes.add(new PmuNodeSnapshot(node.nodeId(), node.pid(), node.name(), node.state(), node.priority(),
                    node.arrivalTime(), node.burstTime(), node.remainingTime(), node.memoryRequirement(),
                    node.parentPid(), node.completionTime(), node.waitingTime(), node.turnaroundTime(),
                    node.responseTime(), node.nextNodeId()));
        }
        return new PmuListSnapshot(source.listId(), source.headNodeId(), source.tailNodeId(), source.size(),
                nodes, count < source.size());
    }

    private synchronized void add(String traceId, StepData data) {
        MutableTrace trace = traces.get(traceId);
        if (trace == null || trace.afterSnapshot != null) return;
        if (trace.steps.size() >= MAX_STEPS_PER_TRACE) { trace.truncated = true; return; }
        trace.steps.add(new PmuTraceStep(trace.steps.size() + 1L, data.kind, data.pid, data.nodeId, data.position,
                data.ownerNodeId, data.oldNextNodeId, data.newNextNodeId, data.oldHeadNodeId,
                data.newHeadNodeId, data.oldTailNodeId, data.newTailNodeId, data.result,
                data.node, data.description));
    }

    private synchronized void complete(String traceId, PmuListSnapshot after, boolean result, String description) {
        MutableTrace trace = traces.get(traceId);
        if (trace == null || trace.afterSnapshot != null) return;
        trace.afterSnapshot = after;
        trace.result = result;
        trace.description = description;
        trace.truncated |= trace.beforeSnapshot.truncated() || after.truncated();
    }

    private PmuTraceSummary summary(MutableTrace trace) {
        return new PmuTraceSummary(trace.traceId, trace.listId, trace.operation, trace.targetPid,
                trace.simulationTime, trace.recordedAt, trace.steps.size(), trace.result,
                trace.truncated, trace.description);
    }

    private record StepData(String kind, Integer pid, Long nodeId, Integer position, Long ownerNodeId,
                            Long oldNextNodeId, Long newNextNodeId, Long oldHeadNodeId, Long newHeadNodeId,
                            Long oldTailNodeId, Long newTailNodeId, Boolean result, PmuNodeSnapshot node,
                            String description) { }

    private static final class MutableTrace {
        private final String traceId, listId, operation;
        private final Integer targetPid, simulationTime;
        private final PmuListSnapshot beforeSnapshot;
        private final Instant recordedAt;
        private final List<PmuTraceStep> steps = new ArrayList<>();
        private PmuListSnapshot afterSnapshot;
        private Boolean result;
        private String description;
        private boolean truncated;
        private MutableTrace(String traceId, String listId, String operation, Integer targetPid,
                             Integer simulationTime, PmuListSnapshot beforeSnapshot, Instant recordedAt) {
            this.traceId = traceId; this.listId = listId; this.operation = operation; this.targetPid = targetPid;
            this.simulationTime = simulationTime; this.beforeSnapshot = beforeSnapshot; this.recordedAt = recordedAt;
            this.truncated = beforeSnapshot.truncated();
        }
    }

    private final class TraceOperation implements ProcessLinkedList.Operation {
        private final String traceId;
        private TraceOperation(String traceId) { this.traceId = traceId; }

        @Override public void nodeVisited(ProcessLinkedList.NodeSnapshot node, int position) {
            add(traceId, new StepData("NODE_VISIT", node.pid(), node.nodeId(), position, null,
                    null, null, null, null, null, null, null, node(node),
                    "Visited logical node N" + node.nodeId() + " for P" + node.pid()));
        }

        @Override public void searchCompared(ProcessLinkedList.NodeSnapshot node, int position, int targetPid, boolean matched) {
            add(traceId, new StepData("SEARCH_COMPARE", targetPid, node.nodeId(), position, null,
                    null, null, null, null, null, null, matched, node(node),
                    "Compared requested P" + targetPid + " with P" + node.pid() + ": " + (matched ? "match" : "no match")));
        }

        @Override public void nodeCreated(ProcessLinkedList.NodeSnapshot node, int position) {
            add(traceId, new StepData("NODE_CREATE", node.pid(), node.nodeId(), position, null,
                    null, null, null, null, null, null, null, node(node),
                    "Allocated logical descriptor N" + node.nodeId() + " for P" + node.pid()));
        }

        @Override public void pointerUpdated(long ownerNodeId, Long oldNextNodeId, Long newNextNodeId, int position) {
            add(traceId, new StepData("POINTER_UPDATE", null, ownerNodeId, position, ownerNodeId,
                    oldNextNodeId, newNextNodeId, null, null, null, null, null, null,
                    "N" + ownerNodeId + ".next changed from " + target(oldNextNodeId) + " to " + target(newNextNodeId)));
        }

        @Override public void headUpdated(Long oldHeadNodeId, Long newHeadNodeId) {
            add(traceId, new StepData("HEAD_UPDATE", null, newHeadNodeId, null, null,
                    null, null, oldHeadNodeId, newHeadNodeId, null, null, null, null,
                    "HEAD changed from " + target(oldHeadNodeId) + " to " + target(newHeadNodeId)));
        }

        @Override public void tailUpdated(Long oldTailNodeId, Long newTailNodeId) {
            add(traceId, new StepData("TAIL_UPDATE", null, newTailNodeId, null, null,
                    null, null, null, null, oldTailNodeId, newTailNodeId, null, null,
                    "TAIL changed from " + target(oldTailNodeId) + " to " + target(newTailNodeId)));
        }

        @Override public void inserted(ProcessLinkedList.NodeSnapshot node, int position) {
            add(traceId, new StepData("INSERT", node.pid(), node.nodeId(), position, null,
                    null, null, null, null, null, null, true, node(node),
                    "Linked P" + node.pid() + " at position " + position));
        }

        @Override public void deleted(ProcessLinkedList.NodeSnapshot node, int position) {
            add(traceId, new StepData("DELETE", node.pid(), node.nodeId(), position, null,
                    null, null, null, null, null, null, true, node(node),
                    "Unlinked P" + node.pid() + " (N" + node.nodeId() + ") from position " + position));
        }

        @Override public void completed(ProcessLinkedList.Snapshot after, boolean result, String description) {
            add(traceId, new StepData("OPERATION_COMPLETE", null, null, null, null,
                    null, null, null, null, null, null, result, null, description));
            ProcessListTraceRecorder.this.complete(traceId, snapshot(after, MAX_RECORDED_NODES_PER_SNAPSHOT), result, description);
        }
    }

    private static PmuNodeSnapshot node(ProcessLinkedList.NodeSnapshot node) {
        return new PmuNodeSnapshot(node.nodeId(), node.pid(), node.name(), node.state(), node.priority(),
                node.arrivalTime(), node.burstTime(), node.remainingTime(), node.memoryRequirement(),
                node.parentPid(), node.completionTime(), node.waitingTime(), node.turnaroundTime(),
                node.responseTime(), node.nextNodeId());
    }

    private static String target(Long nodeId) { return nodeId == null ? "NULL" : "N" + nodeId; }
}
