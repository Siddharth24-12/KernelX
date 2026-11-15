package com.kernelx.dto;

import java.util.List;

public record AluTrace(String traceId, String tableId, String operation, Integer pid,
                       Integer spreadHash, Integer bucketIndex, Integer simulationTime,
                       java.time.Instant recordedAt, AluTableSnapshot beforeSnapshot,
                       AluTableSnapshot afterSnapshot, AluBucketSnapshot bucketBefore,
                       AluBucketSnapshot bucketAfter, List<AluTraceStep> steps, Boolean result,
                       boolean truncated, String description) {
    public AluTrace { steps = List.copyOf(steps); }
}
