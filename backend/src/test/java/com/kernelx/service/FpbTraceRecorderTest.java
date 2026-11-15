package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.dto.FpbTrace;
import com.kernelx.dsa.CustomQueue;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SchedulingProcess;
import java.util.List;
import org.junit.jupiter.api.Test;

class FpbTraceRecorderTest {
    private SchedulingProcess p(int pid, int arrival, int burst) { return new SchedulingProcess(pid, "P" + pid, 3, arrival, burst); }

    @Test void capturesActualFcfsQueueOrderingAndPointerTransitionsWithoutChangingSchedule() {
        FpbTraceRecorder recorder = new FpbTraceRecorder();
        SchedulingService scheduler = new SchedulingService(new HeapTraceRecorder(), recorder);
        var result = scheduler.fcfs(List.of(p(1, 0, 1), p(2, 0, 1)));
        assertEquals(List.of(1, 2), result.gantt().stream().map(com.kernelx.model.GanttSegment::pid).toList());
        FpbTrace trace = recorder.getTrace(recorder.listTraces().get(0).traceId()).orElseThrow();
        assertEquals("FCFS", trace.algorithm()); assertEquals(4, trace.operationCount());
        assertEquals(List.of("ENQUEUE", "ENQUEUE", "DEQUEUE", "DEQUEUE"), trace.steps().stream().map(s -> s.operation()).toList());
        assertEquals(List.of(1, 2), trace.steps().get(1).queueAfter().nodes().stream().map(n -> n.process().pid()).toList());
        assertEquals(trace.steps().get(1).queueAfter().nodes().get(1).nodeId(), trace.steps().get(2).newFrontNodeId());
        assertNull(trace.steps().get(3).queueAfter().frontNodeId());
        assertNull(trace.steps().get(3).queueAfter().rearNodeId());
        assertEquals(trace.initialQueue().queueId(), trace.finalQueue().queueId());
        assertEquals(0, trace.finalQueue().size());
    }

    @Test void recordsRoundRobinReenqueueOnlyForUnfinishedWorkAndKeepsRunsSeparate() {
        FpbTraceRecorder recorder = new FpbTraceRecorder();
        SchedulingService scheduler = new SchedulingService(new HeapTraceRecorder(), recorder);
        var result = scheduler.roundRobin(List.of(p(11, 0, 3), p(12, 0, 1)), 1);
        assertEquals(List.of(11, 12, 11), result.gantt().stream().map(com.kernelx.model.GanttSegment::pid).toList());
        FpbTrace first = recorder.getTrace(recorder.listTraces().get(0).traceId()).orElseThrow();
        assertEquals("ROUND_ROBIN", first.algorithm());
        assertEquals(3, first.steps().stream().filter(s -> "ENQUEUE".equals(s.operation()) && s.pid() == 11).count());
        assertEquals(3, first.steps().stream().filter(s -> "DEQUEUE".equals(s.operation()) && s.pid() == 11).count());

        scheduler.fcfs(List.of(p(21, 0, 1)));
        scheduler.sjf(List.of(p(31, 0, 1)));
        scheduler.priority(List.of(p(41, 0, 1)), false);
        var traces = recorder.listTraces();
        assertEquals(2, traces.size());
        assertNotEquals(traces.get(0).schedulingRunId(), traces.get(1).schedulingRunId());
        assertNotEquals(traces.get(0).traceId(), traces.get(1).traceId());
        assertTrue(traces.stream().allMatch(t -> t.complete() && t.completedAt() != null));
    }

    @Test void unrelatedEventQueueActivityDoesNotCreateFifoSchedulingTraces() {
        FpbTraceRecorder recorder = new FpbTraceRecorder();
        EventManager events = new EventManager();
        for (int i = 0; i < 40; i++) events.record(i + 1, com.kernelx.model.SystemEventType.PROCESS_CREATED, "infrastructure event");
        assertEquals(40, events.snapshot().size());
        assertTrue(recorder.listTraces().isEmpty());
        var live = recorder.liveSnapshot();
        assertFalse(live.active()); assertNull(live.queue());
    }

    @Test void retainsOnlyRecentRunsAndKeepsOperationPrefixesBounded() {
        FpbTraceRecorder recorder = new FpbTraceRecorder();
        SchedulingService scheduler = new SchedulingService(new HeapTraceRecorder(), recorder);
        for (int run = 0; run < 18; run++) scheduler.fcfs(List.of(p(100 + run, 0, 1)));
        assertEquals(16, recorder.listTraces().size());
        assertNotEquals(recorder.listTraces().get(0).traceId(), recorder.listTraces().get(15).traceId());
        assertEquals(SchedulingAlgorithm.FCFS.name(), recorder.listTraces().get(0).algorithm());
    }

    @Test void boundsOperationsAndPerRunSnapshotStorage() {
        FpbTraceRecorder recorder = new FpbTraceRecorder();
        FpbTraceRecorder.RunSession session = recorder.beginRun(SchedulingAlgorithm.FCFS, 1100);
        CustomQueue<SchedulingService.Work> queue = new CustomQueue<>(session);
        session.beginQueue(queue.snapshot(512));
        for (int pid = 1; pid <= 1100; pid++) queue.enqueue(new SchedulingService.Work(p(pid, 0, 1)));
        for (int pid = 1; pid <= 1100; pid++) queue.dequeue();
        session.complete(queue.snapshot(512));
        FpbTrace trace = recorder.getTrace(session.traceId()).orElseThrow();
        assertEquals(2200, trace.operationCount());
        assertEquals(2048, trace.steps().size());
        assertTrue(trace.truncated());
        assertTrue(trace.steps().stream().anyMatch(step -> step.queueAfter().truncated()));
        assertEquals(0, trace.finalQueue().size());
    }
}
