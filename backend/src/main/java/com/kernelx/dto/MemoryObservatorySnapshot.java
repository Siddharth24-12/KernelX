package com.kernelx.dto;

public record MemoryObservatorySnapshot(int totalMemory, int allocatedMemory, int freeMemory,
                                        int allocatedBlockCount, int freeBlockCount, int largestFreeBlock,
                                        double utilizationPercent, double externalFragmentationPercent,
                                        long allocationFailures) { }
