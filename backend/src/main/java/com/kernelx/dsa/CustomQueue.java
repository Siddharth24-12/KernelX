package com.kernelx.dsa;

import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

/** FIFO queue backed by manually linked nodes; enqueue and dequeue are O(1). */
public final class CustomQueue<T> {
    private static final class Node<T> {
        private final long nodeId;
        private final T value;
        private Node<T> next;
        private Node(long nodeId, T value) { this.nodeId = nodeId; this.value = value; }
    }

    public record NodeSnapshot<T>(long nodeId, T value, Long nextNodeId) { }
    public record Snapshot<T>(String queueId, int size, Long frontNodeId, Long rearNodeId,
                              List<NodeSnapshot<T>> nodes, boolean truncated) {
        public Snapshot { nodes = List.copyOf(nodes); }
    }
    public interface Observer<T> {
        default int maxSnapshotNodes() { return Integer.MAX_VALUE; }
        default void enqueued(long nodeId, T value, int sizeBefore, Long frontBefore, Long rearBefore, Snapshot<T> after) { }
        default void dequeued(long nodeId, T value, int sizeBefore, Long frontBefore, Long rearBefore, Snapshot<T> after) { }
    }
    private static final Observer<Object> NO_OBSERVER = new Observer<>() { };

    private Node<T> head;
    private Node<T> tail;
    private int size;
    private long nextNodeId = 1;
    private final String queueId = UUID.randomUUID().toString();
    private final Observer<T> observer;

    @SuppressWarnings("unchecked") public CustomQueue() { this((Observer<T>) NO_OBSERVER); }
    public CustomQueue(Observer<T> observer) { this.observer = Objects.requireNonNull(observer, "observer"); }

    public void enqueue(T value) {
        Objects.requireNonNull(value, "value");
        int sizeBefore = size;
        Long frontBefore = nodeId(head), rearBefore = nodeId(tail);
        Node<T> node = new Node<>(nextNodeId++, value);
        if (tail == null) head = tail = node;
        else { tail.next = node; tail = node; }
        size++;
        if (observed()) observer.enqueued(node.nodeId, value, sizeBefore, frontBefore, rearBefore, snapshot(observer.maxSnapshotNodes()));
    }

    public T dequeue() {
        if (head == null) throw new NoSuchElementException("Queue is empty");
        int sizeBefore = size;
        Long frontBefore = nodeId(head), rearBefore = nodeId(tail);
        Node<T> removed = head;
        T value = head.value;
        head = head.next;
        if (head == null) tail = null;
        size--;
        if (observed()) observer.dequeued(removed.nodeId, value, sizeBefore, frontBefore, rearBefore, snapshot(observer.maxSnapshotNodes()));
        return value;
    }

    public T peek() {
        if (head == null) throw new NoSuchElementException("Queue is empty");
        return head.value;
    }

    public boolean isEmpty() { return size == 0; }
    public int size() { return size; }

    /** Direct immutable view; this method does not invoke operation instrumentation. */
    public Snapshot<T> snapshot() {
        return snapshot(Integer.MAX_VALUE);
    }

    /** Bounded direct snapshot used by diagnostic observers to cap per-step trace memory. */
    public Snapshot<T> snapshot(int maxNodes) {
        if (maxNodes < 0) throw new IllegalArgumentException("Maximum node count must not be negative");
        List<NodeSnapshot<T>> nodes = new ArrayList<>(Math.min(size, maxNodes));
        Node<T> current = head;
        while (current != null && nodes.size() < maxNodes) {
            nodes.add(new NodeSnapshot<>(current.nodeId, current.value, nodeId(current.next)));
            current = current.next;
        }
        return new Snapshot<>(queueId, size, nodeId(head), nodeId(tail), nodes, nodes.size() < size);
    }

    private static <T> Long nodeId(Node<T> node) { return node == null ? null : node.nodeId; }
    private boolean observed() { return observer != NO_OBSERVER; }

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
