package com.kernelx.dto;

import com.kernelx.model.SchedulingAlgorithm;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ComparisonConfigurationRequest(
        @NotBlank @Size(max = 64) String configurationId,
        @NotBlank @Size(max = 80) String label,
        @NotNull SchedulingAlgorithm algorithm,
        @Positive @Max(100000) Integer timeQuantum,
        boolean preemptivePriority) { }
