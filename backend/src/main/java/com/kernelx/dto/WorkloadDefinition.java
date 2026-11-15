package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import java.time.Instant;
import java.util.List;

public record WorkloadDefinition(String id, String name, String description, Instant createdAt, Instant updatedAt,
                                 List<WorkloadProcessDefinition> processes, SchedulingAlgorithm algorithm,
                                 int timeQuantum, boolean preemptivePriority, int totalMemory,
                                 MemoryAllocationStrategy memoryAllocationStrategy, double speed) { }
