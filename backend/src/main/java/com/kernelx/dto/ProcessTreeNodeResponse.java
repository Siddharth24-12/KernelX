package com.kernelx.dto;

import com.kernelx.model.ProcessState;
import java.util.List;

public record ProcessTreeNodeResponse(int pid, String name, ProcessState state, int priority,
                                      int parentPid, int arrivalTime, int burstTime,
                                      int remainingTime, int memoryRequirement,
                                      List<ProcessTreeNodeResponse> children) {
    public ProcessTreeNodeResponse { children = List.copyOf(children); }
}
