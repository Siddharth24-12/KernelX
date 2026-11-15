package com.kernelx.dto;

import java.util.List;

public record PmuTrace(String traceId, String listId, String operation, Integer targetPid,
                       Integer simulationTime, PmuListSnapshot beforeSnapshot, PmuListSnapshot afterSnapshot,
                       List<PmuTraceStep> steps, Boolean result, boolean truncated, String description) {
    public PmuTrace { steps = List.copyOf(steps); }
}
