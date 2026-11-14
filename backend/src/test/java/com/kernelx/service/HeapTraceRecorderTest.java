package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.dto.HeapRunTrace;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SchedulingProcess;
import java.util.List;
import org.junit.jupiter.api.Test;

class HeapTraceRecorderTest {
    @Test void retainsReplayableActualPriorityHeapOperationsAfterSchedulerReturns() {
        HeapTraceRecorder recorder = new HeapTraceRecorder();
        SchedulingService scheduling = new SchedulingService(recorder);
        scheduling.priority(List.of(
                new SchedulingProcess(1, "low", 1, 0, 2),
                new SchedulingProcess(2, "high", 5, 0, 1),
                new SchedulingProcess(3, "middle", 3, 0, 1)), false);

        var summaries = recorder.listRuns();
        assertEquals(1, summaries.size());
        assertEquals("PRIORITY", summaries.getFirst().algorithm());
        assertEquals(3, summaries.getFirst().processCount());
        assertNotNull(summaries.getFirst().completedAt());
        HeapRunTrace trace = recorder.getRun(summaries.getFirst().runId()).orElseThrow();
        assertTrue(trace.steps().stream().anyMatch(step -> step.kind().equals("INSERT")));
        assertTrue(trace.steps().stream().anyMatch(step -> step.kind().equals("COMPARE")));
        assertTrue(trace.steps().stream().anyMatch(step -> step.kind().equals("SWAP")));
        assertTrue(trace.steps().stream().anyMatch(step -> step.kind().equals("EXTRACT_MAX")));
        assertTrue(trace.finalHeap().isEmpty());
        assertFalse(trace.truncated());
    }

    @Test void givesEachRecordedSchedulingRunAStableUniqueIdentifier() {
        HeapTraceRecorder recorder = new HeapTraceRecorder();
        SchedulingService scheduling = new SchedulingService(recorder);
        List<SchedulingProcess> work = List.of(new SchedulingProcess(1, "worker", 4, 0, 1));
        scheduling.priority(work, false);
        scheduling.priority(work, true);
        assertNotEquals(recorder.listRuns().get(0).runId(), recorder.listRuns().get(1).runId());
        assertEquals(SchedulingAlgorithm.PRIORITY.name(), recorder.listRuns().get(1).algorithm());
    }
}
