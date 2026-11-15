package com.kernelx.dto;

import java.time.Instant;

public record FpbTraceSummary(String traceId, String schedulingRunId, String queueId, String algorithm,
                              int processCount, int operationCount, Instant startedAt, Instant completedAt,
                              boolean complete, boolean truncated) { }
