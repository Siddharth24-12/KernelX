package com.kernelx.dto;

import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;

public record ProcessResponse(int pid, String name, int priority, int arrivalTime, int burstTime,
                              int remainingTime, int memoryRequirement, int parentPid, ProcessState state,
                              int completionTime, int waitingTime, int turnaroundTime, int responseTime) {
    public static ProcessResponse from(ProcessControlBlock process) {
        return new ProcessResponse(process.getPid(), process.getName(), process.getPriority(),
                process.getArrivalTime(), process.getBurstTime(), process.getRemainingTime(),
                process.getMemoryRequirement(), process.getParentPid(), process.getState(),
                process.getCompletionTime(), process.getWaitingTime(), process.getTurnaroundTime(), process.getResponseTime());
    }
}
