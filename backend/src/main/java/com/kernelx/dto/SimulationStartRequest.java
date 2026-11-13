package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SimulationConfiguration;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record SimulationStartRequest(
        @NotNull SchedulingAlgorithm algorithm,
        @Positive Integer timeQuantum,
        Boolean preemptivePriority,
        @Positive Integer totalMemory,
        @NotNull MemoryAllocationStrategy memoryAllocationStrategy,
        @DecimalMin("0.1") @DecimalMax("10.0") Double speed) {
    public SimulationConfiguration toSimulationConfiguration() {
        int quantum = timeQuantum == null ? 0 : timeQuantum;
        return new SimulationConfiguration(algorithm, quantum, Boolean.TRUE.equals(preemptivePriority));
    }
}
