package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.ProcessState;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SimulationConfiguration;
import com.kernelx.model.SimulationStatus;
import com.kernelx.model.SystemEventType;
import org.junit.jupiter.api.Test;

class SimulationEngineTest {
    private record Fixture(EventManager events, ProcessManager processes, MemoryManager memory, SimulationEngine engine) { }
    private Fixture fixture() {
        EventManager events = new EventManager();
        ProcessManager processes = new ProcessManager(events);
        MemoryManager memory = new MemoryManager(128, events);
        SimulationEngine engine = new SimulationEngine(processes, memory, events, new SchedulingService());
        return new Fixture(events, processes, memory, engine);
    }

    @Test void ticksPauseResumeCompletesMetricsAndRecordsTimelineEvents() {
        Fixture f = fixture();
        f.processes.createProcess(1, "one", 2, 0, 3, 32, -1);
        f.processes.createProcess(2, "two", 2, 1, 2, 32, -1);
        assertTrue(f.engine.allocateProcessMemory(1, MemoryAllocationStrategy.FIRST_FIT));
        assertEquals(SimulationStatus.RUNNING, f.engine.start(new SimulationConfiguration(SchedulingAlgorithm.ROUND_ROBIN, 1, false)).status());
        var first = f.engine.tick();
        assertEquals(1, first.currentTime());
        assertEquals(2, f.processes.getProcess(1).getRemainingTime());
        assertEquals(SimulationStatus.PAUSED, f.engine.pause().status());
        assertEquals(1, f.engine.tick().currentTime());
        assertEquals(SimulationStatus.RUNNING, f.engine.resume().status());
        assertEquals(SimulationStatus.COMPLETED, f.engine.tick(20).status());
        assertEquals(5, f.engine.state().currentTime());
        assertEquals(ProcessState.TERMINATED, f.processes.getProcess(1).getState());
        assertEquals(2, f.processes.getProcess(1).getWaitingTime());
        assertEquals(5, f.engine.schedulingResult().gantt().getLast().endTime());
        assertEquals(128, f.engine.memorySnapshot().freeMemory());
        assertTrue(f.engine.events().stream().anyMatch(event -> event.type() == SystemEventType.SIMULATION_PAUSED));
        assertTrue(f.engine.events().stream().anyMatch(event -> event.type() == SystemEventType.SCHEDULING_DECISION));
    }

    @Test void resetRestoresPcbMemoryAndClockAndSpeedIsValidated() {
        Fixture f = fixture();
        f.processes.createProcess(1, "one", 1, 0, 2, 40, -1);
        assertTrue(f.engine.allocateProcessMemory(1, MemoryAllocationStrategy.BEST_FIT));
        f.engine.start(SimulationConfiguration.fcfs());
        f.engine.tick();
        f.engine.setSpeed(2.5);
        assertEquals(2.5, f.engine.state().speed());
        assertThrows(IllegalArgumentException.class, () -> f.engine.setSpeed(0));
        var reset = f.engine.reset();
        assertEquals(SimulationStatus.READY, reset.status());
        assertEquals(0, reset.currentTime());
        assertEquals(128, f.engine.memorySnapshot().freeMemory());
        assertEquals(2, f.processes.getProcess(1).getRemainingTime());
        assertEquals(ProcessState.NEW, f.processes.getProcess(1).getState());
        assertTrue(f.engine.events().stream().anyMatch(event -> event.type() == SystemEventType.SIMULATION_RESET));
    }

    @Test void terminatingAProcessReleasesItsSimulatedMemory() {
        Fixture f = fixture();
        f.processes.createProcess(9, "allocated", 1, 0, 1, 40, -1);
        assertTrue(f.engine.allocateProcessMemory(9, MemoryAllocationStrategy.FIRST_FIT));
        assertEquals(88, f.engine.memorySnapshot().freeMemory());
        assertTrue(f.processes.terminateProcess(9));
        assertEquals(128, f.engine.memorySnapshot().freeMemory());
        assertTrue(f.engine.events().stream().anyMatch(event -> event.pid() != null && event.pid() == 9
                && event.type() == SystemEventType.MEMORY_DEALLOCATED));
    }
}
