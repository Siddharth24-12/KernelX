package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.SystemEventType;
import org.junit.jupiter.api.Test;

class MemoryManagerTest {
    @Test void firstBestAndWorstFitChooseExpectedFreeBlock() {
        for (MemoryAllocationStrategy strategy : MemoryAllocationStrategy.values()) {
            EventManager events = new EventManager();
            MemoryManager memory = new MemoryManager(100, events);
            memory.allocate(1, 10, MemoryAllocationStrategy.FIRST_FIT);
            memory.allocate(2, 30, MemoryAllocationStrategy.FIRST_FIT);
            memory.allocate(3, 20, MemoryAllocationStrategy.FIRST_FIT);
            memory.deallocate(1);
            memory.deallocate(3); // free holes are 10 at 0 and 60 at 40
            assertTrue(memory.allocate(4, 8, strategy));
            int start = memory.snapshot().blocks().stream().filter(block -> block.pid() != null && block.pid() == 4)
                    .findFirst().orElseThrow().startAddress();
            if (strategy == MemoryAllocationStrategy.WORST_FIT) assertEquals(40, start);
            else assertEquals(0, start);
        }
    }

    @Test void reportsFragmentationRejectsImpossibleAllocationAndCoalescesFreeBlocks() {
        EventManager events = new EventManager();
        MemoryManager memory = new MemoryManager(100, events);
        memory.allocate(1, 40, MemoryAllocationStrategy.FIRST_FIT);
        memory.allocate(2, 40, MemoryAllocationStrategy.FIRST_FIT);
        memory.deallocate(1);
        assertEquals(60, memory.snapshot().freeMemory());
        assertFalse(memory.allocate(3, 50, MemoryAllocationStrategy.FIRST_FIT));
        assertFalse(memory.deallocate(99));
        assertThrows(IllegalStateException.class, () -> memory.allocate(2, 5, MemoryAllocationStrategy.FIRST_FIT));
        assertTrue(memory.deallocate(2));
        MemorySnapshot allFree = memory.snapshot();
        assertEquals(0, allFree.allocatedMemory());
        assertEquals(100, allFree.freeMemory());
        assertEquals(1, allFree.blocks().size());
        assertEquals(SystemEventType.MEMORY_DEALLOCATED, events.snapshot().getLast().type());
        assertThrows(IllegalArgumentException.class, () -> memory.allocate(5, 0, MemoryAllocationStrategy.FIRST_FIT));
    }
}
