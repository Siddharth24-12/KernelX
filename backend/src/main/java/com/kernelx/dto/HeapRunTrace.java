package com.kernelx.dto;

import java.time.Instant;
import java.util.List;

public record HeapRunTrace(String runId, String algorithm, boolean preemptive, int processCount,
                           Instant startedAt, Instant completedAt, List<HeapSlotSnapshot> finalHeap,
                           List<HeapTraceStep> steps, boolean truncated) {
    public HeapRunTrace {
        finalHeap = List.copyOf(finalHeap);
        steps = List.copyOf(steps);
    }
}
