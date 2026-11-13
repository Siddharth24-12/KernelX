package com.kernelx.model;

import java.util.List;

public record MemorySnapshot(int totalMemory, int allocatedMemory, int freeMemory, List<MemoryBlockView> blocks) {
    public MemorySnapshot { blocks = List.copyOf(blocks); }
}
