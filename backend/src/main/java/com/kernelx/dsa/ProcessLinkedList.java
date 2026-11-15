package com.kernelx.dsa;

import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;

/** Singly linked PCB store. PID uniqueness checks make insertion O(n); search/removal are O(n). */
public final class ProcessLinkedList {
    private static final Operation NO_OP = new Operation() { };

    private static final class Node {
        private final long nodeId;
        private final ProcessControlBlock process;
        private Node next;
        private Node(long nodeId, ProcessControlBlock process) { this.nodeId = nodeId; this.process = process; }
    }

    /** Immutable logical view of one actual list node; nodeId is not a physical address. */
    public record NodeSnapshot(long nodeId, int pid, String name, ProcessState state, int priority,
                               int arrivalTime, int burstTime, int remainingTime, int memoryRequirement,
                               int parentPid, int completionTime, int waitingTime, int turnaroundTime,
                               int responseTime, Long nextNodeId) { }

    /** Read-only linked-list shape captured at one instant. */
    public record Snapshot(String listId, Long headNodeId, Long tailNodeId, int size,
                           List<NodeSnapshot> nodes) {
        public Snapshot { nodes = List.copyOf(nodes); }
    }

    /** Observer hooks are invoked at the real list access and pointer mutation sites. */
    public interface Observer {
        default Operation begin(String kind, Integer targetPid, Snapshot before) { return NO_OP; }
    }

    public interface Operation {
        default void nodeVisited(NodeSnapshot node, int position) { }
        default void searchCompared(NodeSnapshot node, int position, int targetPid, boolean matched) { }
        default void nodeCreated(NodeSnapshot node, int position) { }
        default void pointerUpdated(long ownerNodeId, Long oldNextNodeId, Long newNextNodeId, int position) { }
        default void headUpdated(Long oldHeadNodeId, Long newHeadNodeId) { }
        default void tailUpdated(Long oldTailNodeId, Long newTailNodeId) { }
        default void inserted(NodeSnapshot node, int position) { }
        default void deleted(NodeSnapshot node, int position) { }
        default void completed(Snapshot after, boolean success, String description) { }
    }

    private static final Observer NO_OBSERVER = new Observer() { };

    private final String listId = UUID.randomUUID().toString();
    private final Observer observer;
    private Node head;
    private Node tail;
    private long nextNodeId = 1;
    private int size;

    public ProcessLinkedList() { this(NO_OBSERVER); }

    public ProcessLinkedList(Observer observer) { this.observer = Objects.requireNonNull(observer, "observer"); }

    public void insert(ProcessControlBlock process) {
        Objects.requireNonNull(process, "process");
        if (search(process.getPid()) != null) throw new IllegalArgumentException("Duplicate PID: " + process.getPid());

        Operation operation = begin("INSERT", process.getPid());
        Node node = new Node(nextNodeId++, process);
        operation.nodeCreated(snapshot(node), size);
        if (tail == null) {
            Long oldHead = nodeId(head);
            head = node;
            operation.headUpdated(oldHead, node.nodeId);
            Long oldTail = nodeId(tail);
            tail = node;
            operation.tailUpdated(oldTail, node.nodeId);
        } else {
            Node previousTail = tail;
            Long oldNext = nodeId(previousTail.next);
            previousTail.next = node;
            operation.pointerUpdated(previousTail.nodeId, oldNext, node.nodeId, size - 1);
            Long oldTail = previousTail.nodeId;
            tail = node;
            operation.tailUpdated(oldTail, node.nodeId);
        }
        size++;
        operation.inserted(snapshot(node), size - 1);
        complete(operation, true, "Inserted P" + process.getPid() + " at list position " + (size - 1));
    }

    public ProcessControlBlock remove(int pid) {
        Operation operation = begin("DELETE", pid);
        Node previous = null;
        Node current = head;
        int position = 0;
        while (current != null) {
            NodeSnapshot currentSnapshot = snapshot(current);
            operation.nodeVisited(currentSnapshot, position);
            boolean matched = current.process.getPid() == pid;
            operation.searchCompared(currentSnapshot, position, pid, matched);
            if (matched) {
                if (previous == null) {
                    Long oldHead = head.nodeId;
                    head = current.next;
                    operation.headUpdated(oldHead, nodeId(head));
                } else {
                    Long oldNext = nodeId(previous.next);
                    previous.next = current.next;
                    operation.pointerUpdated(previous.nodeId, oldNext, nodeId(previous.next), position - 1);
                }
                if (tail == current) {
                    Long oldTail = tail.nodeId;
                    tail = previous;
                    operation.tailUpdated(oldTail, nodeId(tail));
                }
                size--;
                operation.deleted(currentSnapshot, position);
                complete(operation, true, "Removed P" + pid + " from list position " + position);
                return current.process;
            }
            previous = current;
            current = current.next;
            position++;
        }
        complete(operation, false, "P" + pid + " was not present in the linked list");
        return null;
    }

    public ProcessControlBlock search(int pid) {
        Operation operation = begin("SEARCH", pid);
        Node current = head;
        int position = 0;
        while (current != null) {
            NodeSnapshot currentSnapshot = snapshot(current);
            operation.nodeVisited(currentSnapshot, position);
            boolean matched = current.process.getPid() == pid;
            operation.searchCompared(currentSnapshot, position, pid, matched);
            if (matched) {
                complete(operation, true, "Found P" + pid + " at list position " + position);
                return current.process;
            }
            current = current.next;
            position++;
        }
        complete(operation, false, "P" + pid + " was not present in the linked list");
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
        Operation operation = begin("TRAVERSE", null);
        Node current = head;
        int position = 0;
        while (current != null) {
            operation.nodeVisited(snapshot(current), position);
            visitor.accept(current.process);
            current = current.next;
            position++;
        }
        complete(operation, true, "Traversed " + position + " linked-list nodes from HEAD");
    }

    /** Direct diagnostic read: does not call traverse/search and emits no observer events. */
    public Snapshot snapshot() {
        List<NodeSnapshot> nodes = new ArrayList<>(size);
        IdentityHashMap<Node, Boolean> visited = new IdentityHashMap<>();
        for (Node current = head; current != null && visited.put(current, Boolean.TRUE) == null; current = current.next) {
            nodes.add(snapshot(current));
        }
        return new Snapshot(listId, nodeId(head), nodeId(tail), size, nodes);
    }

    /** Read-only value view for APIs and polling; follows the real links without invoking instrumentation. */
    public List<ProcessControlBlock> valuesSnapshot() {
        List<ProcessControlBlock> values = new ArrayList<>(size);
        IdentityHashMap<Node, Boolean> visited = new IdentityHashMap<>();
        for (Node current = head; current != null && visited.put(current, Boolean.TRUE) == null; current = current.next) {
            values.add(current.process);
        }
        return List.copyOf(values);
    }

    public int size() { return size; }
    public boolean isEmpty() { return size == 0; }

    private NodeSnapshot snapshot(Node node) {
        ProcessControlBlock process = node.process;
        return new NodeSnapshot(node.nodeId, process.getPid(), process.getName(), process.getState(),
                process.getPriority(), process.getArrivalTime(), process.getBurstTime(), process.getRemainingTime(),
                process.getMemoryRequirement(), process.getParentPid(), process.getCompletionTime(),
                process.getWaitingTime(), process.getTurnaroundTime(), process.getResponseTime(), nodeId(node.next));
    }

    private Operation begin(String kind, Integer targetPid) {
        return observer == NO_OBSERVER ? NO_OP : observer.begin(kind, targetPid, snapshot());
    }

    private void complete(Operation operation, boolean result, String description) {
        if (observer != NO_OBSERVER) operation.completed(snapshot(), result, description);
    }

    private static Long nodeId(Node node) { return node == null ? null : node.nodeId; }
}
