package com.kernelx.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateProcessRequest(
        @Positive int pid,
        @NotBlank String name,
        @Min(0) @Max(10) int priority,
        @PositiveOrZero int arrivalTime,
        @Positive int burstTime,
        @Positive int memoryRequirement,
        @Min(-1) Integer parentPid) {
    public CreateProcessRequest {
        parentPid = parentPid == null ? -1 : parentPid;
    }
}
