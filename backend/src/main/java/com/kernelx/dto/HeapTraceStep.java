package com.kernelx.dto;

import java.util.List;

public record HeapTraceStep(long sequence, String kind, int simulationTime,
                            Integer pid, String name, Integer priority,
                            Integer index, Integer otherIndex, Integer comparisonResult,
                            String comparisonPhase, HeapEntrySnapshot value,
                            HeapEntrySnapshot otherValue, List<HeapEntrySnapshot> values,
                            Integer sizeBefore, Integer sizeAfter) {
    public HeapTraceStep { values = values == null ? List.of() : List.copyOf(values); }
}
