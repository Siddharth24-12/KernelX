package com.kernelx.dto;
import java.time.Instant;
public record PtuTraceSummary(String traceId, String operation, Integer targetPid, Instant recordedAt,
    int stepCount, boolean truncated) { }
