package com.kernelx.model;

import java.util.Objects;

/** Immutable scheduling input so previews do not mutate the live PCB list. */
public record SchedulingProcess(int pid, String name, int priority, int arrivalTime, int burstTime) {
    public SchedulingProcess {
        if (pid <= 0) throw new IllegalArgumentException("PID must be positive");
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Name must not be blank");
        ProcessControlBlock.validatePriority(priority);
        if (arrivalTime < 0) throw new IllegalArgumentException("Arrival time must not be negative");
        if (burstTime <= 0) throw new IllegalArgumentException("Burst time must be positive");
    }

    public static SchedulingProcess from(ProcessControlBlock process) {
        Objects.requireNonNull(process, "process");
        return new SchedulingProcess(process.getPid(), process.getName(), process.getPriority(),
                process.getArrivalTime(), process.getBurstTime());
    }
}
