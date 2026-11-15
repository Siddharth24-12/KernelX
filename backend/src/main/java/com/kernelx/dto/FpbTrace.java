package com.kernelx.dto;

import java.time.Instant;
import java.util.List;

public record FpbTrace(String traceId, String schedulingRunId, String queueId, String algorithm,
                       int processCount, int operationCount, Instant startedAt, Instant completedAt,
                       boolean complete, boolean truncated, FpbQueueSnapshot initialQueue,
                       FpbQueueSnapshot finalQueue, List<FpbTraceStep> steps) {
    public FpbTrace { steps = List.copyOf(steps); }
}
