package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record WorkloadRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 500) String description,
        @NotEmpty @Size(max = 256) List<@Valid WorkloadProcessDefinition> processes,
        @NotNull SchedulingAlgorithm algorithm,
        @Min(0) @Max(100000) int timeQuantum,
        boolean preemptivePriority,
        @Positive int totalMemory,
        @NotNull MemoryAllocationStrategy memoryAllocationStrategy,
        @DecimalMin("0.1") @DecimalMax("10.0") double speed) { }
