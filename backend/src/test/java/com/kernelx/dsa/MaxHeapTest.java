package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Comparator;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.Test;

class MaxHeapTest {
    @Test void insertsExtractsMaxAndResizes() {
        MaxHeap<Integer> heap = new MaxHeap<>(Comparator.naturalOrder(), 1);
        assertThrows(NoSuchElementException.class, heap::peekMax);
        assertThrows(NoSuchElementException.class, heap::extractMax);
        for (int value : new int[]{4, 1, 9, 2, 7, 3}) heap.insert(value);
        assertEquals(9, heap.peekMax());
        assertEquals(9, heap.extractMax());
        assertEquals(7, heap.extractMax());
        assertEquals(4, heap.extractMax());
        assertEquals(3, heap.extractMax());
        assertEquals(2, heap.extractMax());
        assertEquals(1, heap.extractMax());
        assertTrue(heap.isEmpty());
    }

    @Test void heapifyAndUpdateRestoreOrderingInBothDirections() {
        MaxHeap<Integer> heap = new MaxHeap<>(Comparator.naturalOrder());
        heap.heapify(new Integer[]{5, 1, 8, 4, 2});
        assertEquals(8, heap.peekMax());
        assertTrue(heap.update(1, 10));
        assertEquals(10, heap.peekMax());
        assertTrue(heap.update(10, 0));
        assertEquals(8, heap.extractMax());
        assertFalse(heap.update(100, 0));
        heap.heapify(new Integer[0]);
        assertTrue(heap.isEmpty());
    }
}
