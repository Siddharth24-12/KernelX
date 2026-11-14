package com.kernelx.dto;

import java.time.Instant;

public record HeapRunSummary(String runId, String algorithm, boolean preemptive, int processCount,
                             Instant startedAt, Instant completedAt, int operationCount,
                             boolean truncated) { }
