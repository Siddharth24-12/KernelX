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
}
