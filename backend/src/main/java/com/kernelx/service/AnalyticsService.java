package com.kernelx.service;

import com.kernelx.dto.AnalyticsRuntimeState;
import com.kernelx.dto.AnalyticsSnapshot;
import com.kernelx.dto.CpuObservatorySnapshot;
import com.kernelx.dto.CpuTickSample;
import com.kernelx.dto.MemoryObservatorySnapshot;
import com.kernelx.dto.ProcessAnalyticsRow;
import com.kernelx.dto.ProcessObservatorySnapshot;
import com.kernelx.model.MemoryBlockView;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.ProcessState;
import com.kernelx.model.SystemEvent;
import com.kernelx.model.SystemEventType;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** Read-only analytics projections over the active runtime and existing persisted event history. */
@Service
public final class AnalyticsService {
    private final SimulationRuntimeService runtime;
    private final SimulationAnalyticsHistory cpuHistory;
    private final EventLogPersistenceService eventLog;

    public AnalyticsService(SimulationRuntimeService runtime, SimulationAnalyticsHistory cpuHistory,
                            EventLogPersistenceService eventLog) {
        this.runtime = runtime;
        this.cpuHistory = cpuHistory;
        this.eventLog = eventLog;
    }

    public AnalyticsSnapshot snapshot() {
        AnalyticsRuntimeState live = runtime.analyticsRuntimeState();
        List<SystemEvent> events = eventLog.findAll();
        return new AnalyticsSnapshot(Instant.now(), cpu(live), memory(live.memory(), count(events, SystemEventType.MEMORY_ALLOCATION_FAILED)),
                processes(live.processes()));
    }

    static CpuObservatorySnapshot cpu(AnalyticsRuntimeState live, SimulationAnalyticsHistory.Snapshot history) {
        var state = live.simulation();
        CpuTickSample latest = history.samples().stream().filter(sample -> sample.runId().equals(history.currentRunId())).reduce((first, second) -> second).orElse(null);
        int completed = (int) live.processes().stream().filter(process -> process.state() == ProcessState.TERMINATED
                && process.remainingTime() == 0).count();
        return new CpuObservatorySnapshot(state.status(), state.currentTime(), state.totalTime(), state.runningPid(),
                state.readyPids(), completed, history.currentRunId(), latest == null ? null : latest.cumulativeBusyTicks(),
                latest == null ? null : latest.cumulativeIdleTicks(), latest == null ? null : latest.utilizationPercent(),
                history.samples(), observedGantt(history.currentRunId(), history.samples()), live.scheduledGantt(),
                state.completedSegments(), 1, SimulationAnalyticsHistory.MAX_SAMPLES,
                history.retainedSampleCount(), history.historyTruncated());
    }

    static List<com.kernelx.model.GanttSegment> observedGantt(String runId, List<CpuTickSample> samples) {
        java.util.ArrayList<com.kernelx.model.GanttSegment> intervals = new java.util.ArrayList<>();
        if (runId == null) return List.of();
        for (CpuTickSample sample : samples) {
            if (!runId.equals(sample.runId())) continue;
            int pid = sample.runningPid() == null ? -1 : sample.runningPid();
            int start = sample.simulationTime() - 1;
            int end = sample.simulationTime();
            if (!intervals.isEmpty()) {
                var previous = intervals.getLast();
                if (previous.pid() == pid && previous.endTime() == start) {
                    intervals.set(intervals.size() - 1, new com.kernelx.model.GanttSegment(pid, sample.processName(),
                            previous.startTime(), end, end - previous.startTime(), pid == -1));
                    continue;
                }
            }
            intervals.add(new com.kernelx.model.GanttSegment(pid, sample.processName(), start, end, 1, pid == -1));
        }
        return List.copyOf(intervals);
    }

    private CpuObservatorySnapshot cpu(AnalyticsRuntimeState live) {
        return cpu(live, cpuHistory.snapshot());
    }

    static MemoryObservatorySnapshot memory(MemorySnapshot snapshot, long allocationFailures) {
        int allocatedBlocks = 0;
        int freeBlocks = 0;
        int largestFree = 0;
        for (MemoryBlockView block : snapshot.blocks()) {
            if (block.free()) {
                freeBlocks++;
                largestFree = Math.max(largestFree, block.size());
            } else allocatedBlocks++;
        }
        double utilization = 100.0 * snapshot.allocatedMemory() / snapshot.totalMemory();
        double fragmentation = snapshot.freeMemory() == 0 ? 0.0
                : 100.0 * (1.0 - (double) largestFree / snapshot.freeMemory());
        return new MemoryObservatorySnapshot(snapshot.totalMemory(), snapshot.allocatedMemory(), snapshot.freeMemory(),
                allocatedBlocks, freeBlocks, largestFree, utilization, fragmentation, allocationFailures);
    }

    static ProcessObservatorySnapshot processes(List<ProcessAnalyticsRow> rows) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (ProcessState state : ProcessState.values()) counts.put(state.name(), 0);
        rows.forEach(row -> counts.compute(row.state().name(), (key, count) -> count == null ? 1 : count + 1));
        return new ProcessObservatorySnapshot(counts, rows, rows.size());
    }

    private long count(List<SystemEvent> events, SystemEventType type) {
        return events.stream().filter(event -> event.type() == type).count();
    }
}
