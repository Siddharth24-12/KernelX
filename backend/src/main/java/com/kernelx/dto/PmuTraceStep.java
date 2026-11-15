package com.kernelx.dto;

public record PmuTraceStep(long sequence, String kind, Integer pid, Long nodeId, Integer position,
                           Long ownerNodeId, Long oldNextNodeId, Long newNextNodeId,
                           Long oldHeadNodeId, Long newHeadNodeId, Long oldTailNodeId, Long newTailNodeId,
                           Boolean result, PmuNodeSnapshot node, String description) { }
