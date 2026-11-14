package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
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

    @Test void observerReportsActualHeapifyComparisonsSwapsExtractionAndUpdate() {
        List<String> operations = new ArrayList<>();
        MaxHeap<Integer> heap = new MaxHeap<Integer>(Comparator.naturalOrder(), new MaxHeap.Observer<Integer>() {
            @Override public void onHeapify(List<Integer> values) { operations.add("heapify:" + values); }
            @Override public void onInsert(Integer value, int index, int sizeBefore) { operations.add("insert:" + value + "@" + index); }
            @Override public void onExtractMax(Integer maximum, Integer replacement, int sizeBefore) { operations.add("extract:" + maximum); }
            @Override public void onUpdate(Integer previous, Integer replacement, int index) { operations.add("update:" + previous + "->" + replacement); }
            @Override public void onCompare(int leftIndex, Integer left, int rightIndex, Integer right, int result, String phase) { operations.add("compare:" + phase); }
            @Override public void onSwap(int leftIndex, Integer left, int rightIndex, Integer right) { operations.add("swap:" + leftIndex + ":" + rightIndex); }
        });
        heap.heapify(new Integer[]{2, 1});
        heap.insert(5);
        assertTrue(heap.update(1, 7));
        assertEquals(7, heap.extractMax());
        assertEquals(List.of(5, 2), heap.snapshot());
        assertTrue(operations.contains("heapify:[2, 1]"));
        assertTrue(operations.contains("insert:5@2"));
        assertTrue(operations.stream().anyMatch(value -> value.startsWith("compare:")));
        assertTrue(operations.stream().anyMatch(value -> value.startsWith("swap:")));
        assertTrue(operations.contains("update:1->7"));
        assertTrue(operations.contains("extract:7"));
    }
}
