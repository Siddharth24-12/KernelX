package com.kernelx.dto;

import java.util.List;

public record PmuListSnapshot(String listId, Long headNodeId, Long tailNodeId, int size,
                              List<PmuNodeSnapshot> nodes, boolean truncated) {
    public PmuListSnapshot { nodes = List.copyOf(nodes); }
}
