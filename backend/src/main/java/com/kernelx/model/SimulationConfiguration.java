package com.kernelx.model;

public record SimulationConfiguration(SchedulingAlgorithm algorithm, int timeQuantum,
                                      boolean preemptivePriority) {
    public SimulationConfiguration {
        if (algorithm == null) throw new IllegalArgumentException("Scheduling algorithm is required");
        if (algorithm == SchedulingAlgorithm.ROUND_ROBIN && timeQuantum <= 0) {
            throw new IllegalArgumentException("Round Robin time quantum must be positive");
        }
        if (algorithm != SchedulingAlgorithm.ROUND_ROBIN && timeQuantum < 0) {
            throw new IllegalArgumentException("Time quantum must not be negative");
        }
    }

    public static SimulationConfiguration fcfs() {
        return new SimulationConfiguration(SchedulingAlgorithm.FCFS, 0, false);
    }
}
