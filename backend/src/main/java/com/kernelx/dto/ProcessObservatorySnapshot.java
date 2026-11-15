package com.kernelx.dto;

import java.util.List;
import java.util.Map;

public record ProcessObservatorySnapshot(Map<String, Integer> stateCounts, List<ProcessAnalyticsRow> processes,
                                         int processTableCount) {
    public ProcessObservatorySnapshot {
        stateCounts = Map.copyOf(stateCounts);
        processes = List.copyOf(processes);
    }
}
