package com.kernelx.dto;
import java.time.Instant;
import java.util.List;
public record PtuTrace(String traceId, String operation, Integer targetPid, Instant recordedAt,
    List<PtuNodeSnapshot> finalTree, List<PtuTraceStep> steps, boolean truncated) {
    public PtuTrace { finalTree = List.copyOf(finalTree); steps = List.copyOf(steps); }
}
