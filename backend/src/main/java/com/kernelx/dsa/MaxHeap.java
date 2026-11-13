package com.kernelx.dsa;

import java.util.Comparator;
import java.util.NoSuchElementException;
import java.util.Objects;

/** Array-backed binary max heap. Insert/extract/priority repair are O(log n). */
public final class MaxHeap<T> {
    private Object[] elements;
    private int size;
    private final Comparator<? super T> comparator;

    public MaxHeap(Comparator<? super T> comparator) { this(comparator, 16); }

    public MaxHeap(Comparator<? super T> comparator, int initialCapacity) {
        this.comparator = Objects.requireNonNull(comparator, "comparator");
        if (initialCapacity < 1) throw new IllegalArgumentException("Initial capacity must be positive");
        elements = new Object[initialCapacity];
    }

    /** Bottom-up heap construction in O(n). Replaces all existing contents. */
    public void heapify(T[] values) {
        Objects.requireNonNull(values, "values");
        elements = new Object[Math.max(1, values.length)];
        size = values.length;
        for (int i = 0; i < values.length; i++) elements[i] = Objects.requireNonNull(values[i], "heap value");
        for (int i = size / 2 - 1; i >= 0; i--) siftDown(i);
    }

    public void insert(T value) {
        Objects.requireNonNull(value, "value");
        ensureCapacity();
        elements[size] = value;
        siftUp(size++);
    }

    public T extractMax() {
        if (size == 0) throw new NoSuchElementException("Heap is empty");
        T maximum = elementAt(0);
        elements[0] = elements[--size];
        elements[size] = null;
        if (size > 0) siftDown(0);
        return maximum;
    }

    public T peekMax() {
        if (size == 0) throw new NoSuchElementException("Heap is empty");
        return elementAt(0);
    }

    /** Replaces an equal entry and restores the heap; search is O(n), repair O(log n). */
    public boolean update(T oldValue, T replacement) {
        Objects.requireNonNull(replacement, "replacement");
        for (int i = 0; i < size; i++) {
            if (Objects.equals(elements[i], oldValue)) {
                elements[i] = replacement;
                if (i > 0 && compare(elementAt(i), elementAt(parent(i))) > 0) siftUp(i);
                else siftDown(i);
                return true;
            }
        }
        return false;
    }

    public int size() { return size; }
    public boolean isEmpty() { return size == 0; }

    private void ensureCapacity() {
        if (size == elements.length) {
            Object[] expanded = new Object[elements.length * 2];
            System.arraycopy(elements, 0, expanded, 0, size);
            elements = expanded;
        }
    }

    private void siftUp(int index) {
        while (index > 0) {
            int parent = parent(index);
            if (compare(elementAt(index), elementAt(parent)) <= 0) break;
            swap(index, parent);
            index = parent;
        }
    }

    private void siftDown(int index) {
        while (true) {
            int left = index * 2 + 1;
            if (left >= size) return;
            int right = left + 1;
            int largest = right < size && compare(elementAt(right), elementAt(left)) > 0 ? right : left;
            if (compare(elementAt(index), elementAt(largest)) >= 0) return;
            swap(index, largest);
            index = largest;
        }
    }

    private int compare(T left, T right) { return comparator.compare(left, right); }
    private int parent(int index) { return (index - 1) / 2; }
    @SuppressWarnings("unchecked") private T elementAt(int index) { return (T) elements[index]; }
    private void swap(int left, int right) { Object value = elements[left]; elements[left] = elements[right]; elements[right] = value; }
}
