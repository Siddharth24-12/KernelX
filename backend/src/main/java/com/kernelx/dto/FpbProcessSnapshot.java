package com.kernelx.dto;

/** Immutable process data captured when the scheduler queue operation occurred. */
public record FpbProcessSnapshot(int pid, String name, int priority, int arrivalTime,
                                 int burstTime, int remainingTime) { }
