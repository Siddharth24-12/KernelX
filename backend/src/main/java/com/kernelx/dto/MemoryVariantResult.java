package com.kernelx.dto;

import com.kernelx.model.MemoryBlockView;
import java.util.List;

public record MemoryVariantResult(int successfulAllocations, int failedAllocations, int successfulDeallocations,
                                  int totalMemory, int allocatedMemory, int freeMemory, int largestFreeBlock,
                                  double externalFragmentation, List<MemoryBlockView> blocks,
                                  List<MemoryOperationResult> operations) {
    public MemoryVariantResult { blocks = List.copyOf(blocks); operations = List.copyOf(operations); }
}
