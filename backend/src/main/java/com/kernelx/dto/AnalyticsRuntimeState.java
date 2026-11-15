package com.kernelx.dto;

import com.kernelx.model.GanttSegment;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.SimulationSnapshot;
import java.util.List;

/** Atomic, read-only view of runtime-owned data captured under the runtime lock. */
public record AnalyticsRuntimeState(SimulationSnapshot simulation, MemorySnapshot memory,
                                    List<ProcessAnalyticsRow> processes, List<GanttSegment> scheduledGantt) {
    public AnalyticsRuntimeState {
        processes = List.copyOf(processes);
        scheduledGantt = List.copyOf(scheduledGantt);
    }
}
