package com.kernelx.dto;

import java.time.Instant;

public record PmuTraceSummary(String traceId, String listId, String operation, Integer targetPid,
                              Integer simulationTime, Instant recordedAt, int stepCount,
                              Boolean result, boolean truncated, String description) { }
