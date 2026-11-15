package com.kernelx.service;

import com.kernelx.dto.CpuTickSample;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Bounded in-memory telemetry written only by actual SimulationEngine tick boundaries. */
@Component
public final class SimulationAnalyticsHistory {
    public static final int MAX_SAMPLES = 4096;
    public record Snapshot(String currentRunId, List<CpuTickSample> samples, int retainedSampleCount,
                           boolean historyTruncated) {
        public Snapshot { samples = List.copyOf(samples); }
    }
    private final Deque<CpuTickSample> samples = new ArrayDeque<>();
    private String currentRunId;
    private int busyTicks;
    private int idleTicks;
    private long totalRecorded;

    public synchronized String beginRun() {
        currentRunId = UUID.randomUUID().toString();
        busyTicks = 0;
        idleTicks = 0;
        return currentRunId;
    }

    public synchronized void recordTick(int simulationTime, Integer executedPid, String processName, int readyCount,
                                        int waitingCount, int completedCount) {
        if (currentRunId == null) return;
        if (executedPid == null) idleTicks++; else busyTicks++;
        int elapsed = busyTicks + idleTicks;
        samples.addLast(new CpuTickSample(currentRunId, simulationTime, executedPid, processName, readyCount,
                waitingCount, completedCount, busyTicks, idleTicks, 100.0 * busyTicks / elapsed));
        totalRecorded++;
        while (samples.size() > MAX_SAMPLES) samples.removeFirst();
    }

    public synchronized String currentRunId() { return currentRunId; }
    public synchronized int busyTicks() { return busyTicks; }
    public synchronized int idleTicks() { return idleTicks; }
    public synchronized List<CpuTickSample> currentRunSamples() {
        if (currentRunId == null) return List.of();
        return samples.stream().filter(sample -> sample.runId().equals(currentRunId)).toList();
    }
    public synchronized List<CpuTickSample> allSamples() { return List.copyOf(samples); }
    public synchronized int retainedSampleCount() { return samples.size(); }
    public synchronized boolean historyTruncated() { return totalRecorded > MAX_SAMPLES; }
    public synchronized Snapshot snapshot() { return new Snapshot(currentRunId, List.copyOf(samples), samples.size(), totalRecorded > MAX_SAMPLES); }
}
