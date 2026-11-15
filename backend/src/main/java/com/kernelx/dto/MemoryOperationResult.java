package com.kernelx.dto;

import com.kernelx.dto.MemoryExperimentOperation.Operation;

public record MemoryOperationResult(int index, Operation operation, int pid, Integer amount,
                                    boolean succeeded, String outcome) { }
