package com.kernelx.dto;

import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;

public record SavedProcessSnapshot(int pid, String name, int priority, int arrivalTime, int burstTime,
                                   int remainingTime, int completionTime, int waitingTime,
                                   int turnaroundTime, int responseTime, int memoryRequirement,
                                   int parentPid, ProcessState state) {
    public static SavedProcessSnapshot from(ProcessControlBlock process) {
        return new SavedProcessSnapshot(process.getPid(), process.getName(), process.getPriority(),
                process.getArrivalTime(), process.getBurstTime(), process.getRemainingTime(),
                process.getCompletionTime(), process.getWaitingTime(), process.getTurnaroundTime(),
                process.getResponseTime(), process.getMemoryRequirement(), process.getParentPid(), process.getState());
    }
}
