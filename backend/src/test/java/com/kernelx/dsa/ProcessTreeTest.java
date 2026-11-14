package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import com.kernelx.model.ProcessControlBlock;
import java.util.ArrayList;
import java.util.List;
import java.lang.reflect.Field;
import java.time.Duration;
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

    @Test void snapshotsHierarchyAndStopsOnMalformedCycles() throws Exception {
        ProcessTree tree = new ProcessTree();
        assertTrue(tree.snapshot().isEmpty());
        tree.add(process(1, -1)); tree.add(process(2, 1));
        Field rootField = ProcessTree.class.getDeclaredField("root"); rootField.setAccessible(true);
        Object root = rootField.get(tree);
        Field childField = root.getClass().getDeclaredField("firstChild"); childField.setAccessible(true);
        Object child = childField.get(root);
        childField.set(child, root); // malformed child cycle: root -> child -> root
        assertTimeoutPreemptively(Duration.ofSeconds(1), () -> {
            var snapshot = tree.snapshot();
            assertEquals(1, snapshot.size());
            assertEquals(1, snapshot.get(0).children().size());
            assertEquals(2, snapshot.get(0).children().get(0).process().getPid());
            assertTrue(snapshot.get(0).children().get(0).children().isEmpty());
        });
    }
}
