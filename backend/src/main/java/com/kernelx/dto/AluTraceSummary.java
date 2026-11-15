package com.kernelx.dto;

import java.time.Instant;

public record AluTraceSummary(String traceId, String tableId, String operation, Integer pid,
                              Integer spreadHash, Integer bucketIndex, Integer simulationTime,
                              Instant recordedAt, int stepCount, Boolean result, boolean truncated,
                              String description) { }
