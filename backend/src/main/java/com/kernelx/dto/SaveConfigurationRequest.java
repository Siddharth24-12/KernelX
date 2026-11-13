package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record SaveConfigurationRequest(
        @NotBlank @Size(max = 80) String name,
        @NotNull SchedulingAlgorithm algorithm,
        @Min(0) @Max(100000) int timeQuantum,
        boolean preemptivePriority,
        @Positive int totalMemory,
        @NotNull MemoryAllocationStrategy memoryAllocationStrategy,
        @DecimalMin("0.1") @DecimalMax("10.0") double speed) { }
