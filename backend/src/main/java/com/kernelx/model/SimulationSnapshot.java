package com.kernelx.model;

import java.util.List;

public record SimulationSnapshot(SimulationStatus status, SchedulingAlgorithm algorithm,
                                int currentTime, int totalTime, double speed,
                                Integer runningPid, List<Integer> readyPids,
                                List<Integer> waitingPids, List<GanttSegment> completedSegments) {
    public SimulationSnapshot {
        readyPids = List.copyOf(readyPids);
        waitingPids = List.copyOf(waitingPids);
        completedSegments = List.copyOf(completedSegments);
    }
}
