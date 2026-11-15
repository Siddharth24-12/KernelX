package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.dsa.CustomHashTable;
import com.kernelx.model.ProcessControlBlock;
import org.junit.jupiter.api.Test;

class AluTraceRecorderTest {
    @Test void retainsBoundedRecentOperationsAndSnapshotsAreReadOnly() {
        AluTraceRecorder recorder = new AluTraceRecorder();
        CustomHashTable<Integer, ProcessControlBlock> table = new CustomHashTable<>(recorder);
        for (int pid = 1; pid <= 70; pid++) {
            var process = new ProcessControlBlock(pid, "p" + pid, 1, 0, 1, 8, -1);
            table.put(pid, process);
        }
        assertEquals(64, recorder.listTraces().size());
        int tracesBefore = recorder.listTraces().size();
        var live = table.snapshot();
        for (int i = 0; i < 4; i++) assertEquals(live, table.snapshot());
        assertEquals(tracesBefore, recorder.listTraces().size());
        String oldestRetained = recorder.listTraces().get(0).traceId();
        assertTrue(recorder.getTrace(oldestRetained).isPresent());
        assertEquals(tracesBefore, recorder.listTraces().size());
    }
}
