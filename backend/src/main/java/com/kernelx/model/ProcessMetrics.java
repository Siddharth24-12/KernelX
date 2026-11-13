package com.kernelx.model;

public record ProcessMetrics(int pid, String name, int completionTime, int turnaroundTime,
                             int waitingTime, int responseTime) { }
