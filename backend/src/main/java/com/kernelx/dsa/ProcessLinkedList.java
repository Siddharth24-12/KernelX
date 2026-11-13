package com.kernelx.dsa;

import com.kernelx.model.ProcessControlBlock;
import java.util.Objects;
import java.util.function.Consumer;

/** Singly linked PCB store. PID uniqueness checks make insertion O(n); search/removal are O(n). */
public final class ProcessLinkedList {
    private static final class Node {
        private ProcessControlBlock process;
        private Node next;
        private Node(ProcessControlBlock process) { this.process = process; }
    }

    private Node head;
    private Node tail;
    private int size;

    public void insert(ProcessControlBlock process) {
        Objects.requireNonNull(process, "process");
        if (search(process.getPid()) != null) throw new IllegalArgumentException("Duplicate PID: " + process.getPid());
        Node node = new Node(process);
        if (tail == null) head = tail = node;
        else { tail.next = node; tail = node; }
        size++;
    }

    public ProcessControlBlock remove(int pid) {
        Node previous = null;
        Node current = head;
        while (current != null) {
            if (current.process.getPid() == pid) {
                if (previous == null) head = current.next;
                else previous.next = current.next;
                if (tail == current) tail = previous;
                size--;
                return current.process;
            }
            previous = current;
            current = current.next;
        }
        return null;
    }

    public ProcessControlBlock search(int pid) {
        for (Node current = head; current != null; current = current.next) {
            if (current.process.getPid() == pid) return current.process;
        }
        return null;
    }

    public boolean update(int pid, Consumer<ProcessControlBlock> updater) {
        Objects.requireNonNull(updater, "updater");
        ProcessControlBlock process = search(pid);
        if (process == null) return false;
        updater.accept(process);
        return true;
    }

    public void traverse(Consumer<ProcessControlBlock> visitor) {
        Objects.requireNonNull(visitor, "visitor");
        for (Node current = head; current != null; current = current.next) visitor.accept(current.process);
    }

    public int size() { return size; }
    public boolean isEmpty() { return size == 0; }
}
