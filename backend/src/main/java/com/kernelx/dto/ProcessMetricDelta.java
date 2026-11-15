package com.kernelx.dto;

public record ProcessMetricDelta(String variantId, int pid, String processName,
                                 int baselineWaitingTime, int variantWaitingTime,
                                 int waitingDifference, int baselineTurnaroundTime,
                                 int variantTurnaroundTime, int turnaroundDifference,
                                 int baselineResponseTime, int variantResponseTime,
                                 int responseDifference) { }
