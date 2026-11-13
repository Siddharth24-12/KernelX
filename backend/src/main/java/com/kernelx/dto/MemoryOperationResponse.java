package com.kernelx.dto;

import com.kernelx.model.MemorySnapshot;

public record MemoryOperationResponse(boolean success, MemorySnapshot memory) { }
