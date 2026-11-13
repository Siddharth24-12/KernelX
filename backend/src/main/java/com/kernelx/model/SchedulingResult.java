package com.kernelx.model;

import java.util.List;

public record SchedulingResult(SchedulingAlgorithm algorithm, boolean preemptive, int timeQuantum,
                               List<GanttSegment> gantt,
                               List<ProcessMetrics> processes,
                               double averageWaitingTime,
                               double averageTurnaroundTime,
                               double averageResponseTime,
                               int totalTime) {
    public SchedulingResult {
        gantt = List.copyOf(gantt);
        processes = List.copyOf(processes);
    }
}
