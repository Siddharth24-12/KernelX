package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;
import com.kernelx.dsa.ProcessTree;
import com.kernelx.model.ProcessControlBlock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProcessTreeTraceRecorderTest {
    @Test void retainsOnlyNewestThirtyTwoTracesAndBoundsSteps() {
        ProcessTreeTraceRecorder recorder = new ProcessTreeTraceRecorder();
        ProcessTree tree = new ProcessTree(recorder::record);
        for (int pid = 1; pid <= 40; pid++) tree.add(new ProcessControlBlock(pid, "p" + pid, 1, 0, 1, 1, -1));
        assertEquals(32, recorder.list().size());
        assertEquals(40, recorder.list().get(31).targetPid());
        assertTrue(recorder.get(recorder.list().get(0).traceId()).isPresent());
    }
    @Test void capsAnIndividualTraceAt2048Steps() {
        ProcessTreeTraceRecorder recorder = new ProcessTreeTraceRecorder();
        List<ProcessTree.TraceStepData> steps = new ArrayList<>();
        for (int i=0;i<2100;i++) steps.add(new ProcessTree.TraceStepData("NODE_SEARCH", i, null, null, null, null, null, i, null, null, null, "visit"));
        var data = new ProcessTree.TraceData("bounded", "SEARCH", 1, Instant.now(), steps, List.of(), false);
        recorder.record(data);
        var trace = recorder.get("bounded").orElseThrow();
        assertEquals(2048, trace.steps().size()); assertTrue(trace.truncated());
    }
}
