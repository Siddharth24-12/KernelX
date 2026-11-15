package com.kernelx.dto;

public record FpbTraceStep(long sequence, String operation, Integer pid, int sizeBefore, int sizeAfter,
                           Long oldFrontNodeId, Long newFrontNodeId, Long oldRearNodeId, Long newRearNodeId,
                           FpbProcessSnapshot process, FpbQueueSnapshot queueAfter, String description) { }
