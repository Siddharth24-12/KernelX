package com.kernelx.dto;

import jakarta.validation.constraints.Positive;

public record MemoryDeallocationRequest(@Positive int pid) { }
