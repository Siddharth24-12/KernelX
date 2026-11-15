package com.kernelx.dto;

import com.kernelx.model.ProcessState;

/** Copied PCB metadata for one actual custom hash-table node. */
public record AluEntrySnapshot(long entryId, int pid, String name, ProcessState state, int priority,
                               int arrivalTime, int burstTime, int remainingTime, int memoryRequirement,
                               int parentPid, int completionTime, int waitingTime, int turnaroundTime,
                               int responseTime, Long nextEntryId) { }
