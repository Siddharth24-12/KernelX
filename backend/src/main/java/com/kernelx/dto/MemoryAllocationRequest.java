package com.kernelx.dto;

import com.kernelx.model.MemoryAllocationStrategy;
import jakarta.validation.constraints.Positive;

public record MemoryAllocationRequest(@Positive int pid, MemoryAllocationStrategy strategy) { }
