package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.dsa.ProcessLinkedList;
import com.kernelx.model.ProcessControlBlock;
import org.junit.jupiter.api.Test;

class ProcessListTraceRecorderTest {
    private ProcessControlBlock pcb(int pid) { return new ProcessControlBlock(pid, "p" + pid, 3, 0, 4, 32, -1); }

    @Test void recordsActualSearchTraversalAndDeletionAndKeepsHistoricalSnapshots() {
        ProcessListTraceRecorder recorder = new ProcessListTraceRecorder();
        ProcessLinkedList list = new ProcessLinkedList(recorder);
        list.insert(pcb(1)); list.insert(pcb(2));
        assertNotNull(list.search(2));
        assertNull(list.search(99));
        list.traverse(ignored -> { });
        ProcessLinkedList.Snapshot beforeRead = list.snapshot();
        int traceCount = recorder.listTraces().size();
        assertEquals(beforeRead, list.snapshot());
        assertEquals(traceCount, recorder.listTraces().size(), "snapshot reads are not traced");
        long success = recorder.listTraces().stream().filter(t -> "SEARCH".equals(t.operation()) && Integer.valueOf(2).equals(t.targetPid()) && Boolean.TRUE.equals(t.result())).count();
        long missing = recorder.listTraces().stream().filter(t -> "SEARCH".equals(t.operation()) && Integer.valueOf(99).equals(t.targetPid()) && Boolean.FALSE.equals(t.result())).count();
        assertEquals(1, success); assertEquals(1, missing);
        list.remove(1);
        var historicalDelete = recorder.listTraces().stream().filter(t -> "DELETE".equals(t.operation())).findFirst().orElseThrow();
        assertEquals(5, historicalDelete.stepCount());
        assertEquals(2, recorder.getTrace(historicalDelete.traceId()).orElseThrow().beforeSnapshot().size());
        assertEquals(1, recorder.getTrace(historicalDelete.traceId()).orElseThrow().afterSnapshot().size());
    }

    @Test void retainsOnlyLatestThirtyTwoOperationTraces() {
        ProcessListTraceRecorder recorder = new ProcessListTraceRecorder();
        ProcessLinkedList list = new ProcessLinkedList(recorder);
        for (int i = 0; i < 40; i++) list.search(1000 + i);
        assertEquals(32, recorder.listTraces().size());
        assertEquals(1008, recorder.listTraces().get(0).targetPid());
    }
}
