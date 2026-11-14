package com.kernelx.dto;

public record HeapEntrySnapshot(int pid, String name, int priority, int arrivalTime,
                                int burstTime, int remainingTime) { }
