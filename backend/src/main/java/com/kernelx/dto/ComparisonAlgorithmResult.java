package com.kernelx.dto;

import com.kernelx.model.GanttSegment;
import com.kernelx.model.ProcessMetrics;
import com.kernelx.model.SchedulingAlgorithm;
import java.util.List;

public record ComparisonAlgorithmResult(
        String configurationId,
        String label,
        SchedulingAlgorithm algorithm,
        boolean preemptive,
        int timeQuantum,
        List<GanttSegment> gantt,
        List<ProcessMetrics> processes,
        double averageWaitingTime,
        double averageTurnaroundTime,
        double averageResponseTime,
        int totalTime,
        double cpuUtilization,
        double throughput) {
    public ComparisonAlgorithmResult {
        gantt = List.copyOf(gantt);
        processes = List.copyOf(processes);
    }
}
