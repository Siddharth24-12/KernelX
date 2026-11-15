package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;

public record ExperimentConfiguration(SchedulingAlgorithm algorithm, Integer timeQuantum,
                                      boolean preemptivePriority, MemoryAllocationStrategy memoryStrategy,
                                      Integer totalMemory) { }
