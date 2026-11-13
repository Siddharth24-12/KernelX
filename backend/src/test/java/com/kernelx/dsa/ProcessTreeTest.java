package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.ProcessControlBlock;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProcessTreeTest {
    private ProcessControlBlock process(int pid, int parent) {
        return new ProcessControlBlock(pid, "p" + pid, 3, 0, 5, 64, parent);
    }

    @Test void addsFindsTraversesAndDisplaysHierarchy() {
        ProcessTree tree = new ProcessTree();
        tree.add(process(1, -1));
        tree.add(process(2, 1));
        tree.add(process(3, 1));
        tree.add(process(4, 2));
        assertEquals(4, tree.size());
        assertEquals(4, tree.find(4).getPid());
        assertNull(tree.find(44));
        List<Integer> order = new ArrayList<>();
        tree.traversePreOrder(pcb -> order.add(pcb.getPid()));
        assertEquals(List.of(1, 2, 4, 3), order);
        assertTrue(tree.displayHierarchy().contains("  2 p2"));
    }

    @Test void rejectsInvalidAddsAndRemovesSubtreesAndRoot() {
        ProcessTree tree = new ProcessTree();
        assertFalse(tree.remove(9));
        assertThrows(IllegalArgumentException.class, () -> tree.add(process(2, 1)));
        tree.add(process(1, -1));
        tree.add(process(2, 1));
        tree.add(process(3, 2));
        tree.add(process(4, 1));
        assertThrows(IllegalArgumentException.class, () -> tree.add(process(2, 1)));
        assertTrue(tree.remove(2));
        assertEquals(2, tree.size());
        assertNull(tree.find(3));
        assertTrue(tree.remove(1));
        assertTrue(tree.isEmpty());
        assertEquals(0, tree.size());
    }

    @Test void supportsMultipleRootProcessesAsAForest() {
        ProcessTree tree = new ProcessTree();
        tree.add(process(1, -1));
        tree.add(process(10, -1));
        tree.add(process(2, 1));
        List<Integer> order = new ArrayList<>();
        tree.traversePreOrder(pcb -> order.add(pcb.getPid()));
        assertEquals(List.of(1, 2, 10), order);
        assertNotNull(tree.find(10));
        assertTrue(tree.remove(1));
        assertEquals(1, tree.size());
        assertEquals(10, tree.find(10).getPid());
    }
}
