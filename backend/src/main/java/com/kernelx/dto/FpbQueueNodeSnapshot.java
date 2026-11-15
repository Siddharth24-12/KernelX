package com.kernelx.dto;

public record FpbQueueNodeSnapshot(long nodeId, FpbProcessSnapshot process, Long nextNodeId) { }
