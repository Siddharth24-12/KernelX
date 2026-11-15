package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class CustomQueueTest {
    @Test void fifoEnqueuePeekDequeueAndReuse() {
        CustomQueue<Integer> queue = new CustomQueue<>();
        assertTrue(queue.isEmpty());
        assertThrows(NoSuchElementException.class, queue::peek);
        assertThrows(NoSuchElementException.class, queue::dequeue);
        queue.enqueue(1); queue.enqueue(2);
        assertEquals(1, queue.peek());
        assertEquals("[1, 2]", queue.display());
        assertEquals(1, queue.dequeue());
        assertEquals(2, queue.dequeue());
        assertTrue(queue.isEmpty());
        queue.enqueue(3);
        assertEquals(3, queue.dequeue());
    }

    @Test void rejectsNullValues() {
        assertThrows(NullPointerException.class, () -> new CustomQueue<>().enqueue(null));
    }

    @Test void observerReceivesActualFifoPointerChangesWhileSnapshotsStayReadOnly() {
        java.util.List<String> operations = new java.util.ArrayList<>();
        CustomQueue.Observer<Integer> observer = new CustomQueue.Observer<>() {
            @Override public void enqueued(long id, Integer value, int before, Long front, Long rear, CustomQueue.Snapshot<Integer> after) {
                operations.add("ENQUEUE:" + value + ":" + before + ":" + after.size() + ":" + front + ":" + rear + ":" + after.frontNodeId() + ":" + after.rearNodeId());
            }
            @Override public void dequeued(long id, Integer value, int before, Long front, Long rear, CustomQueue.Snapshot<Integer> after) {
                operations.add("DEQUEUE:" + value + ":" + before + ":" + after.size() + ":" + front + ":" + rear + ":" + after.frontNodeId() + ":" + after.rearNodeId());
            }
        };
        CustomQueue<Integer> queue = new CustomQueue<>(observer);
        queue.enqueue(5); queue.enqueue(8);
        var live = queue.snapshot(); int recorded = operations.size();
        for (int i = 0; i < 4; i++) assertEquals(live, queue.snapshot());
        assertEquals(recorded, operations.size());
        assertEquals(java.util.List.of("ENQUEUE:5:0:1:null:null:1:1", "ENQUEUE:8:1:2:1:1:1:2"), operations);
        queue.dequeue(); queue.dequeue();
        assertTrue(operations.get(2).startsWith("DEQUEUE:5:2:1:1:2:2:2"));
        assertTrue(operations.get(3).startsWith("DEQUEUE:8:1:0:2:2:null:null"));
        assertThrows(NoSuchElementException.class, queue::dequeue);
    }
}
