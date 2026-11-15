package com.kernelx.dto;

import com.kernelx.model.GanttSegment;
import com.kernelx.model.SimulationStatus;
import java.util.List;

public record CpuObservatorySnapshot(SimulationStatus status, int currentTime, int totalTime,
                                     Integer currentRunningPid, List<Integer> readyPids,
                                     int completedProcessCount, String runId,
                                     Integer observedBusyTicks, Integer observedIdleTicks,
                                     Double observedUtilizationPercent, List<CpuTickSample> samples,
                                     List<GanttSegment> observedGantt, List<GanttSegment> scheduledGantt,
                                     List<GanttSegment> completedGantt,
                                     int sampleIntervalTicks, int maxRetainedSamples,
                                     int retainedSampleCount, boolean historyTruncated) {
    public CpuObservatorySnapshot {
        readyPids = List.copyOf(readyPids);
        samples = List.copyOf(samples);
        observedGantt = List.copyOf(observedGantt);
        scheduledGantt = List.copyOf(scheduledGantt);
        completedGantt = List.copyOf(completedGantt);
    }
}
