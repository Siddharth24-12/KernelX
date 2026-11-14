package com.kernelx.dsa;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;

/** Array-backed binary max heap. Insert/extract/priority repair are O(log n). */
public final class MaxHeap<T> {
    public interface Observer<T> {
        default void onHeapify(List<T> values) { }
        default void onInsert(T value, int index, int sizeBefore) { }
        default void onExtractMax(T maximum, T replacement, int sizeBefore) { }
        default void onUpdate(T previous, T replacement, int index) { }
        default void onCompare(int leftIndex, T left, int rightIndex, T right, int result, String phase) { }
        default void onSwap(int leftIndex, T left, int rightIndex, T right) { }
    }

    private Object[] elements;
    private int size;
    private final Comparator<? super T> comparator;
    private final Observer<T> observer;

    public MaxHeap(Comparator<? super T> comparator) { this(comparator, 16, new Observer<>() { }); }

    public MaxHeap(Comparator<? super T> comparator, Observer<T> observer) { this(comparator, 16, observer); }

    public MaxHeap(Comparator<? super T> comparator, int initialCapacity) {
        this(comparator, initialCapacity, new Observer<>() { });
    }

    public MaxHeap(Comparator<? super T> comparator, int initialCapacity, Observer<T> observer) {
        this.comparator = Objects.requireNonNull(comparator, "comparator");
        this.observer = Objects.requireNonNull(observer, "observer");
        if (initialCapacity < 1) throw new IllegalArgumentException("Initial capacity must be positive");
        elements = new Object[initialCapacity];
    }

    /** Bottom-up heap construction in O(n). Replaces all existing contents. */
    public void heapify(T[] values) {
        Objects.requireNonNull(values, "values");
        elements = new Object[Math.max(1, values.length)];
        size = values.length;
        for (int i = 0; i < values.length; i++) elements[i] = Objects.requireNonNull(values[i], "heap value");
        observer.onHeapify(List.copyOf(Arrays.asList(values.clone())));
        for (int i = size / 2 - 1; i >= 0; i--) siftDown(i);
    }

    public void insert(T value) {
        Objects.requireNonNull(value, "value");
        ensureCapacity();
        int sizeBefore = size;
        elements[size] = value;
        observer.onInsert(value, size, sizeBefore);
        siftUp(size++);
    }

    public T extractMax() {
        if (size == 0) throw new NoSuchElementException("Heap is empty");
        T maximum = elementAt(0);
        int sizeBefore = size;
        T replacement = size > 1 ? elementAt(size - 1) : null;
        observer.onExtractMax(maximum, replacement, sizeBefore);
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
                @SuppressWarnings("unchecked") T previous = (T) elements[i];
                observer.onUpdate(previous, replacement, i);
                elements[i] = replacement;
                if (i > 0 && compareAt(i, parent(i), "update parent comparison") > 0) siftUp(i);
                else siftDown(i);
                return true;
            }
        }
        return false;
    }

    public int size() { return size; }
    public boolean isEmpty() { return size == 0; }

    /** Indexed read-only snapshot of the current array representation. */
    public List<T> snapshot() {
        List<T> result = new ArrayList<>(size);
        for (int i = 0; i < size; i++) result.add(elementAt(i));
        return List.copyOf(result);
    }

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
            if (compareAt(index, parent, "heapify up") <= 0) break;
            swap(index, parent);
            index = parent;
        }
    }

    private void siftDown(int index) {
        while (true) {
            int left = index * 2 + 1;
            if (left >= size) return;
            int right = left + 1;
            int largest = right < size && compareAt(right, left, "heapify down child selection") > 0 ? right : left;
            if (compareAt(index, largest, "heapify down parent comparison") >= 0) return;
            swap(index, largest);
            index = largest;
        }
    }

    private int compareAt(int leftIndex, int rightIndex, String phase) {
        T left = elementAt(leftIndex), right = elementAt(rightIndex);
        int result = comparator.compare(left, right);
        observer.onCompare(leftIndex, left, rightIndex, right, result, phase);
        return result;
    }
    private int parent(int index) { return (index - 1) / 2; }
    @SuppressWarnings("unchecked") private T elementAt(int index) { return (T) elements[index]; }
    private void swap(int left, int right) {
        observer.onSwap(left, elementAt(left), right, elementAt(right));
        Object value = elements[left]; elements[left] = elements[right]; elements[right] = value;
    }
}
