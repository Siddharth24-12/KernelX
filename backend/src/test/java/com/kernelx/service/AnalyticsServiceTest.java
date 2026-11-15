package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.kernelx.dto.AnalyticsRuntimeState;
import com.kernelx.dto.ProcessAnalyticsRow;
import com.kernelx.model.GanttSegment;
import com.kernelx.model.MemoryBlockView;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.ProcessState;
import com.kernelx.model.SimulationSnapshot;
import com.kernelx.model.SimulationStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

class AnalyticsServiceTest {
    @Test void calculatesMemoryUtilizationAndExternalFragmentationFromRealFreeBlocks() {
        MemorySnapshot memory = new MemorySnapshot(100, 40, 60, List.of(
                new MemoryBlockView(0, 40, 1001, false),
                new MemoryBlockView(40, 20, null, true),
                new MemoryBlockView(60, 12, 1002, false),
                new MemoryBlockView(72, 28, null, true)));

        var result = AnalyticsService.memory(memory, 3);

        assertEquals(40.0, result.utilizationPercent(), 0.00001);
        assertEquals(53.333333, result.externalFragmentationPercent(), 0.00001);
        assertEquals(2, result.allocatedBlockCount());
        assertEquals(2, result.freeBlockCount());
        assertEquals(28, result.largestFreeBlock());
        assertEquals(3, result.allocationFailures());
    }

    @Test void calculatesObservedCpuIntervalsAndCurrentProcessStateCounts() {
        var sample = new com.kernelx.dto.CpuTickSample("run", 2, 1001, "ready", 1, 0, 1, 1, 1, 50.0);
        var live = new AnalyticsRuntimeState(new SimulationSnapshot(SimulationStatus.RUNNING, null,
                2, 4, 1.0, 1001, List.of(1002), List.of(), List.of()),
                new MemorySnapshot(100, 0, 100, List.of(new MemoryBlockView(0, 100, null, true))),
                List.of(new ProcessAnalyticsRow(1001, "done", ProcessState.TERMINATED, 0, 1, 0, 1, 0, 1, 0),
                        new ProcessAnalyticsRow(1002, "ready", ProcessState.READY, 0, 2, 2, -1, 0, -1, -1)),
                List.of(new GanttSegment(1001, "done", 1, 2, 1, false)));

        var cpu = AnalyticsService.cpu(live, new SimulationAnalyticsHistory.Snapshot("run", List.of(sample), 1, false));
        var processes = AnalyticsService.processes(live.processes());

        assertEquals(50.0, cpu.observedUtilizationPercent());
        assertEquals(1, cpu.observedBusyTicks());
        assertEquals(1, cpu.observedIdleTicks());
        assertEquals(1, cpu.completedProcessCount());
        assertEquals(1, cpu.observedGantt().size());
        assertEquals(1, cpu.observedGantt().getFirst().startTime());
        assertEquals(1, processes.stateCounts().get("READY"));
        assertEquals(1, processes.stateCounts().get("TERMINATED"));
    }
}
