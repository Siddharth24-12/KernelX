package com.kernelx.model;

public record MemoryBlockView(int startAddress, int size, Integer pid, boolean free) { }
