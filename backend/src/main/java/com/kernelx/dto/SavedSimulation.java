package com.kernelx.dto;

import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.SchedulingResult;
import com.kernelx.model.SystemEvent;
import java.time.Instant;
import java.util.List;

public record SavedSimulation(String id, String name, Instant savedAt, SchedulingResult scheduling,
                              List<SavedProcessSnapshot> processes, MemorySnapshot memory,
                              List<SystemEvent> events) {
    public SavedSimulation {
        processes = List.copyOf(processes);
        events = List.copyOf(events);
    }
}
