package com.kernelx.dsa;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.function.Consumer;

/** FIFO queue backed by manually linked nodes; enqueue and dequeue are O(1). */
public final class CustomQueue<T> {
    private static final class Node<T> {
        private final T value;
        private Node<T> next;
        private Node(T value) { this.value = value; }
    }

    private Node<T> head;
    private Node<T> tail;
    private int size;

    public void enqueue(T value) {
        Node<T> node = new Node<>(Objects.requireNonNull(value, "value"));
        if (tail == null) head = tail = node;
        else { tail.next = node; tail = node; }
        size++;
    }

    public T dequeue() {
        if (head == null) throw new NoSuchElementException("Queue is empty");
        T value = head.value;
        head = head.next;
        if (head == null) tail = null;
        size--;
        return value;
    }

    public T peek() {
        if (head == null) throw new NoSuchElementException("Queue is empty");
        return head.value;
    }

    public boolean isEmpty() { return size == 0; }
    public int size() { return size; }

    public void traverse(Consumer<T> visitor) {
        Objects.requireNonNull(visitor, "visitor");
        for (Node<T> current = head; current != null; current = current.next) visitor.accept(current.value);
    }

    public String display() {
        StringBuilder result = new StringBuilder("[");
        for (Node<T> current = head; current != null; current = current.next) {
            if (result.length() > 1) result.append(", ");
            result.append(current.value);
        }
        return result.append(']').toString();
    }
}
