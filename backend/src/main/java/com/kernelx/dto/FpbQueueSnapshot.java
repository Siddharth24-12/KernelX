package com.kernelx.dto;

import java.util.List;

public record FpbQueueSnapshot(String queueId, int size, Long frontNodeId, Long rearNodeId,
                               List<FpbQueueNodeSnapshot> nodes, boolean truncated) {
    public FpbQueueSnapshot { nodes = List.copyOf(nodes); }
}
