package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.ProcessState;
import com.kernelx.model.SystemEventType;
import org.junit.jupiter.api.Test;

class ProcessManagerTest {
    @Test void createsIndexesTransitionsPrioritiesAndCascadesTermination() {
        EventManager events = new EventManager();
        ProcessManager manager = new ProcessManager(events);
        manager.createProcess(1, "root", 2, 0, 5, 10, -1);
        manager.createProcess(2, "child", 3, 1, 3, 10, 1);
        manager.createProcess(3, "grandchild", 4, 2, 2, 10, 2);
        assertThrows(IllegalArgumentException.class, () -> manager.createProcess(1, "duplicate", 1, 0, 1, 1, -1));
        assertThrows(IllegalArgumentException.class, () -> manager.createProcess(4, "orphan", 1, 0, 1, 1, 99));
        assertTrue(manager.pauseProcess(2));
        assertEquals(ProcessState.PAUSED, manager.getProcess(2).getState());
        assertTrue(manager.resumeProcess(2));
        assertEquals(ProcessState.READY, manager.getProcess(2).getState());
        assertTrue(manager.changePriority(2, 8));
        assertEquals(8, manager.getProcess(2).getPriority());
        assertThrows(IllegalArgumentException.class, () -> manager.changePriority(2, -1));
        assertTrue(manager.terminateProcess(2));
        assertNull(manager.getProcess(2));
        assertNull(manager.getProcess(3));
        assertEquals(1, manager.listProcesses().size());
        assertTrue(events.snapshot().stream().anyMatch(event -> event.pid() != null && event.pid() == 3
                && event.type() == SystemEventType.PROCESS_TERMINATED));
    }

    @Test void recordsCrashesAndStructuredEvents() {
        EventManager events = new EventManager();
        ProcessManager manager = new ProcessManager(events);
        manager.createProcess(7, "worker", 1, 0, 2, 4, -1);
        assertTrue(manager.crashProcess(7, "test failure"));
        assertEquals(SystemEventType.PROCESS_CRASHED, events.snapshot().get(1).type());
        assertEquals("test failure", events.snapshot().get(1).description().substring("Process crashed: ".length()));
        assertEquals(4, events.snapshot().size());
    }
}
