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

    @Test void snapshotPreservesStableLogicalNodesAndExactPointersWithoutInstrumentingReads() {
        List<String> operations = new ArrayList<>();
        ProcessLinkedList.Observer observer = new ProcessLinkedList.Observer() {
            @Override public ProcessLinkedList.Operation begin(String kind, Integer pid, ProcessLinkedList.Snapshot before) {
            operations.add(kind + ":begin");
            return new ProcessLinkedList.Operation() {
                @Override public void pointerUpdated(long owner, Long oldNext, Long newNext, int position) { operations.add("POINTER:" + owner + ":" + oldNext + ":" + newNext); }
                @Override public void headUpdated(Long oldHead, Long newHead) { operations.add("HEAD:" + oldHead + ":" + newHead); }
                @Override public void tailUpdated(Long oldTail, Long newTail) { operations.add("TAIL:" + oldTail + ":" + newTail); }
                @Override public void completed(ProcessLinkedList.Snapshot after, boolean success, String description) { operations.add(kind + ":done"); }
            };
            }
        };
        ProcessLinkedList list = new ProcessLinkedList(observer);
        assertEquals(0, list.snapshot().size());
        list.insert(process(10)); list.insert(process(11));
        ProcessLinkedList.Snapshot snapshot = list.snapshot();
        assertEquals(2, snapshot.size());
        assertEquals(snapshot.nodes().get(0).nodeId(), snapshot.headNodeId());
        assertEquals(snapshot.nodes().get(1).nodeId(), snapshot.tailNodeId());
        assertEquals(snapshot.nodes().get(1).nodeId(), snapshot.nodes().get(0).nextNodeId());
        assertNull(snapshot.nodes().get(1).nextNodeId());
        int operationCount = operations.size();
        assertEquals(snapshot, list.snapshot());
        assertEquals(operationCount, operations.size(), "diagnostic snapshots must not create operations");
        list.remove(10);
        assertTrue(operations.indexOf("POINTER:" + snapshot.headNodeId() + ":null:" + snapshot.nodes().get(1).nodeId()) >= 0);
        assertEquals(snapshot.nodes().get(0).nodeId(), snapshot.headNodeId(), "old immutable snapshot remains historical");
        assertEquals(List.of("SEARCH:begin", "SEARCH:done", "INSERT:begin", "HEAD:null:1", "TAIL:null:1", "INSERT:done"), operations.subList(0, 6));
    }

    @Test void snapshotsAndTraversalRemainCorrectForLargeLists() {
        ProcessLinkedList list = new ProcessLinkedList();
        for (int pid = 1; pid <= 1000; pid++) list.insert(process(pid));
        ProcessLinkedList.Snapshot snapshot = list.snapshot();
        assertEquals(1000, snapshot.size());
        assertEquals(1, snapshot.nodes().get(0).pid());
        assertEquals(1000, snapshot.nodes().get(999).pid());
        assertEquals(snapshot.tailNodeId(), snapshot.nodes().get(999).nodeId());
        assertNull(snapshot.nodes().get(999).nextNodeId());
        List<Integer> pids = new ArrayList<>();
        list.traverse(pcb -> pids.add(pcb.getPid()));
        assertEquals(1000, pids.size());
        assertEquals(1000, pids.get(999));
    }
}
