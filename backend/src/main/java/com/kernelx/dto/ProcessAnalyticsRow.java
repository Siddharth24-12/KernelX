package com.kernelx.dto;

import com.kernelx.model.ProcessState;

public record ProcessAnalyticsRow(int pid, String name, ProcessState state, int arrivalTime,
                                 int burstTime, int remainingTime, int completionTime,
                                 int waitingTime, int turnaroundTime, int responseTime) { }
