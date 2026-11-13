package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SimulationConfiguration;
import java.time.Instant;

public record SavedConfiguration(String id, String name, Instant createdAt,
                                 SimulationConfiguration simulation,
                                 int totalMemory, MemoryAllocationStrategy memoryAllocationStrategy,
                                 double speed) { }
