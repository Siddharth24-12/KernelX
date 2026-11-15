package com.kernelx.service;

import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SchedulingResult;
import java.util.List;

@FunctionalInterface
public interface ComparisonScheduler {
    SchedulingResult schedule(List<SchedulingProcess> processes, SchedulingAlgorithm algorithm,
                              int timeQuantum, boolean preemptivePriority);
}
