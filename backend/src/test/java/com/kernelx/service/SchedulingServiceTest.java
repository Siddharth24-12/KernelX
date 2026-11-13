package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.GanttSegment;
import com.kernelx.model.ProcessMetrics;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SchedulingResult;
import java.util.List;
import org.junit.jupiter.api.Test;

class SchedulingServiceTest {
    private final SchedulingService scheduler = new SchedulingService();
    private SchedulingProcess p(int pid, int priority, int arrival, int burst) {
        return new SchedulingProcess(pid, "P" + pid, priority, arrival, burst);
    }
    private ProcessMetrics metric(SchedulingResult result, int pid) {
        return result.processes().stream().filter(value -> value.pid() == pid).findFirst().orElseThrow();
    }

    @Test void fcfsPreservesArrivalOrderAndRepresentsIdlePeriods() {
        SchedulingResult result = scheduler.fcfs(List.of(p(1, 1, 2, 3), p(2, 1, 2, 2), p(3, 1, 8, 1)));
        assertEquals(List.of(GanttSegment.idle(0, 2),
                new GanttSegment(1, "P1", 2, 5, 3, false),
                new GanttSegment(2, "P2", 5, 7, 2, false),
                GanttSegment.idle(7, 8), new GanttSegment(3, "P3", 8, 9, 1, false)), result.gantt());
        assertEquals(7, metric(result, 2).completionTime());
        assertEquals(3, metric(result, 2).waitingTime());
        assertEquals(3, metric(result, 2).responseTime());
        assertEquals(1.0, result.averageWaitingTime());
        assertEquals(3.0, result.averageTurnaroundTime());
        assertEquals(1.0, result.averageResponseTime());
        assertEquals(9, result.totalTime());
    }

    @Test void sjfChoosesShortestEligibleBurstAndComputesMetrics() {
        SchedulingResult result = scheduler.sjf(List.of(p(1, 1, 0, 8), p(2, 1, 1, 4), p(3, 1, 2, 2)));
        assertEquals(List.of(1, 3, 2), result.gantt().stream().map(GanttSegment::pid).toList());
        assertEquals(new ProcessMetrics(3, "P3", 10, 8, 6, 6), metric(result, 3));
        assertEquals(new ProcessMetrics(2, "P2", 14, 13, 9, 9), metric(result, 2));
        assertEquals(5.0, result.averageResponseTime());
    }

    @Test void roundRobinUsesQuantumAndQueuesBoundaryArrivalsAheadOfExpiredWork() {
        SchedulingResult result = scheduler.roundRobin(List.of(p(1, 1, 0, 5), p(2, 1, 0, 3)), 2);
        assertEquals(List.of(1, 2, 1, 2, 1), result.gantt().stream().map(GanttSegment::pid).toList());
        assertEquals(List.of(2, 4, 6, 7, 8), result.gantt().stream().map(GanttSegment::endTime).toList());
        assertEquals(new ProcessMetrics(1, "P1", 8, 8, 3, 0), metric(result, 1));
        assertEquals(new ProcessMetrics(2, "P2", 7, 7, 4, 2), metric(result, 2));
        assertThrows(IllegalArgumentException.class, () -> scheduler.roundRobin(List.of(p(1, 1, 0, 1)), 0));
    }

    @Test void priorityUsesStableTiesAndCanPreemptForHigherPriority() {
        List<SchedulingProcess> input = List.of(p(1, 2, 0, 5), p(2, 5, 2, 2), p(3, 5, 2, 1));
        SchedulingResult nonPreemptive = scheduler.priority(input, false);
        assertEquals(List.of(1, 2, 3), nonPreemptive.gantt().stream().map(GanttSegment::pid).toList());
        SchedulingResult preemptive = scheduler.priority(input, true);
        assertEquals(List.of(1, 2, 3, 1), preemptive.gantt().stream().map(GanttSegment::pid).toList());
        assertEquals(List.of(0, 2, 4, 5), preemptive.gantt().stream().map(GanttSegment::startTime).toList());
        assertEquals(new ProcessMetrics(1, "P1", 8, 8, 3, 0), metric(preemptive, 1));
        assertEquals(new ProcessMetrics(3, "P3", 5, 3, 2, 2), metric(preemptive, 3));
    }

    @Test void validatesPidsProcessesAndEmptyInput() {
        assertEquals(0, scheduler.fcfs(List.of()).totalTime());
        assertThrows(IllegalArgumentException.class, () -> scheduler.fcfs(List.of(p(1, 1, 0, 1), p(1, 2, 1, 2))));
        assertThrows(IllegalArgumentException.class, () -> new SchedulingProcess(2, "bad", 1, 0, 0));
        assertThrows(IllegalArgumentException.class, () -> new SchedulingProcess(2, "bad", 11, 0, 1));
    }
}
