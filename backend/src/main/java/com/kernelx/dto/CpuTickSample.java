package com.kernelx.dto;

/** One sample emitted after an actual simulation tick has completed. */
public record CpuTickSample(String runId, int simulationTime, Integer runningPid, String processName,
                            int readyProcessCount, int waitingProcessCount, int completedProcessCount,
                            int cumulativeBusyTicks, int cumulativeIdleTicks, double utilizationPercent) { }
