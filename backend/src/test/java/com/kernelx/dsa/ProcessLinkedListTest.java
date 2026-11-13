package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProcessLinkedListTest {
    private ProcessControlBlock process(int pid) { return new ProcessControlBlock(pid, "p" + pid, 3, 0, 5, 64, -1); }

    @Test void insertsSearchesTraversesUpdatesAndRemovesFromEveryPosition() {
        ProcessLinkedList list = new ProcessLinkedList();
        ProcessControlBlock first = process(1), middle = process(2), last = process(3);
        list.insert(first); list.insert(middle); list.insert(last);
        assertSame(middle, list.search(2));
        assertNull(list.search(99));
        assertTrue(list.update(2, pcb -> pcb.setState(ProcessState.READY)));
        assertEquals(ProcessState.READY, middle.getState());
        List<Integer> visited = new ArrayList<>();
        list.traverse(pcb -> visited.add(pcb.getPid()));
        assertEquals(List.of(1, 2, 3), visited);
        assertSame(first, list.remove(1));
        assertSame(last, list.remove(3));
        assertSame(middle, list.remove(2));
        assertNull(list.remove(2));
        assertTrue(list.isEmpty());
        assertEquals(0, list.size());
    }

    @Test void rejectsDuplicatePidAndInvalidPcbValues() {
        ProcessLinkedList list = new ProcessLinkedList();
        list.insert(process(1));
        assertThrows(IllegalArgumentException.class, () -> list.insert(process(1)));
        assertThrows(IllegalArgumentException.class, () -> new ProcessControlBlock(2, "bad", 11, 0, 1, 1, -1));
        assertThrows(IllegalArgumentException.class, () -> new ProcessControlBlock(2, "bad", 1, 0, 0, 1, -1));
        assertFalse(list.update(44, pcb -> pcb.setPriority(2)));
    }
}
