package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import java.util.List;

public record ExperimentVariantRequest(String variantId, String label, SchedulingAlgorithm algorithm,
                                       Integer timeQuantum, Boolean preemptivePriority,
                                       List<ProcessParameterChange> processChanges,
                                       MemoryAllocationStrategy memoryStrategy) { }
