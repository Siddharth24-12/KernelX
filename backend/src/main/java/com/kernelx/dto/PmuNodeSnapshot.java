package com.kernelx.dto;

import com.kernelx.model.ProcessState;

public record PmuNodeSnapshot(long nodeId, int pid, String name, ProcessState state, int priority,
                              int arrivalTime, int burstTime, int remainingTime, int memoryRequirement,
                              int parentPid, int completionTime, int waitingTime, int turnaroundTime,
                              int responseTime, Long nextNodeId) { }
