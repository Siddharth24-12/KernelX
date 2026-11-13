package com.kernelx.dto;

import com.kernelx.model.ProcessMetrics;
import com.kernelx.model.SchedulingResult;
import java.util.List;

public record SchedulingMetricsResponse(List<ProcessMetrics> processes, double averageWaitingTime,
                                        double averageTurnaroundTime, double averageResponseTime) {
    public SchedulingMetricsResponse { processes = List.copyOf(processes); }
    public static SchedulingMetricsResponse from(SchedulingResult result) {
        return new SchedulingMetricsResponse(result.processes(), result.averageWaitingTime(),
                result.averageTurnaroundTime(), result.averageResponseTime());
    }
}
