package com.kernelx.dto;

public record MemoryExperimentOperation(Operation operation, Integer pid, Integer amount) {
    public enum Operation { ALLOCATE, DEALLOCATE }
}
