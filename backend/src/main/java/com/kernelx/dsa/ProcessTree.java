package com.kernelx.dsa;

import com.kernelx.model.ProcessControlBlock;
import java.util.Objects;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.function.Consumer;
import java.time.Instant;
import java.util.UUID;

/** Process forest using first-child/next-sibling links; search is O(n). */
public final class ProcessTree {
    private static final class Node {
        private final ProcessControlBlock process;
        private Node firstChild;
        private Node nextSibling;
        private Node(ProcessControlBlock process) { this.process = process; }
    }

    private Node root;
    private int size;
    private final Consumer<TraceData> traceSink;
    private List<TraceStepData> activeSteps;
    private boolean activeTruncated;

    public ProcessTree() { this(ignored -> { }); }
    public ProcessTree(Consumer<TraceData> traceSink) { this.traceSink = Objects.requireNonNull(traceSink); }

    public record LinkSnapshot(int pid, String name, String state, int parentPid, Integer firstChildPid, Integer nextSiblingPid) { }
    public record TraceStepData(String operation, Integer currentPid, Integer parentPid, Integer firstChildBefore,
        Integer firstChildAfter, Integer nextSiblingBefore, Integer nextSiblingAfter, Integer visitedPid,
        String pointerChange, Integer pointerBeforePid, Integer pointerAfterPid, String description) { }
    public record TraceData(String traceId, String operation, Integer targetPid, Instant recordedAt,
        List<TraceStepData> steps, List<LinkSnapshot> finalTree, boolean truncated) { }

    private void begin(String operation, Integer pid) {
        activeSteps = new ArrayList<>();
        activeTruncated = false;
        activeOperation = operation; activeTarget = pid;
    }
    private String activeOperation; private Integer activeTarget;
    private void step(String operation, Integer pid, Integer parent, Integer firstBefore, Integer firstAfter,
                      Integer siblingBefore, Integer siblingAfter, Integer visited, String pointer, String text) {
        if (activeSteps != null) {
            if (activeSteps.size() >= 2048) { activeTruncated = true; return; }
            activeSteps.add(new TraceStepData(operation, pid, parent, firstBefore, firstAfter,
                    siblingBefore, siblingAfter, visited, pointer, null, null, text));
        }
    }
    private void pointerStep(String operation, Integer pid, Integer parent, Integer firstBefore, Integer firstAfter,
                             Integer siblingBefore, Integer siblingAfter, Integer visited, String pointer,
                             Integer pointerBefore, Integer pointerAfter, String text) {
        int sizeBefore = activeSteps == null ? -1 : activeSteps.size();
        step(operation, pid, parent, firstBefore, firstAfter, siblingBefore, siblingAfter, visited, pointer, text);
        if (activeSteps != null && activeSteps.size() > sizeBefore) {
            int i=activeSteps.size()-1; TraceStepData s=activeSteps.get(i);
            activeSteps.set(i,new TraceStepData(s.operation(),s.currentPid(),s.parentPid(),s.firstChildBefore(),s.firstChildAfter(),s.nextSiblingBefore(),s.nextSiblingAfter(),s.visitedPid(),s.pointerChange(),pointerBefore,pointerAfter,s.description()));
        }
    }
    private void finish(boolean result) {
        if (activeSteps == null) return;
        if (activeSteps.size() < 2048) activeSteps.add(new TraceStepData("OPERATION_COMPLETE", activeTarget, null, null, null, null, null,
                null, null, null, null, "Operation completed; result=" + result));
        else activeTruncated = true;
        List<LinkSnapshot> finalTree = flatSnapshot();
        traceSink.accept(new TraceData(UUID.randomUUID().toString(), activeOperation, activeTarget, Instant.now(),
                List.copyOf(activeSteps), finalTree, activeTruncated || size > finalTree.size()));
        activeSteps = null; activeOperation = null; activeTarget = null; activeTruncated = false;
    }

    public void add(ProcessControlBlock process) {
        Objects.requireNonNull(process, "process");
        if (root == null && process.getParentPid() != -1) throw new IllegalArgumentException("A root process must have parent PID -1");
        begin("INSERT", process.getPid());
        if (findNode(process.getPid()) != null) { step("NODE_SEARCH", process.getPid(), null, null, null, null, null, process.getPid(), null, "Duplicate PID check"); finish(false); throw new IllegalArgumentException("Duplicate PID: " + process.getPid()); }
        if (root == null) {
            root = new Node(process);
            pointerStep("ROOT_INSERT", process.getPid(), null, null, null, null, null, process.getPid(), "root", null, process.getPid(), "Inserted process as first root");
        } else {
            if (process.getParentPid() == -1) {
                Node lastRoot = root;
                while (lastRoot.nextSibling != null) { step("SIBLING_TRAVERSAL", lastRoot.process.getPid(), -1, pid(lastRoot.firstChild), pid(lastRoot.firstChild), pid(lastRoot.nextSibling), pid(lastRoot.nextSibling), lastRoot.process.getPid(), null, "Visited root sibling while locating the final root"); lastRoot = lastRoot.nextSibling; }
                Integer old = pid(lastRoot.nextSibling); lastRoot.nextSibling = new Node(process);
                pointerStep("NEXT_SIBLING_UPDATE", lastRoot.process.getPid(), null, null, null, old, process.getPid(), process.getPid(), "P" + lastRoot.process.getPid() + ".nextSibling", old, process.getPid(), "Linked new root after final root");
            } else {
                Node parent = findNode(process.getParentPid());
                if (parent == null) { finish(false); throw new IllegalArgumentException("Parent process not found: " + process.getParentPid()); }
                Node child = new Node(process);
                if (parent.firstChild == null) { parent.firstChild = child; pointerStep("FIRST_CHILD_UPDATE", parent.process.getPid(), process.getParentPid(), null, process.getPid(), null, null, process.getPid(), "P" + parent.process.getPid() + ".firstChild", null, process.getPid(), "Attached first child"); }
                else {
                    Node last = parent.firstChild;
                    while (last.nextSibling != null) { step("SIBLING_TRAVERSAL", last.process.getPid(), process.getParentPid(), null, null, pid(last.nextSibling), pid(last.nextSibling), last.process.getPid(), null, "Visited child sibling while locating the final child"); last = last.nextSibling; }
                    last.nextSibling = child;
                    pointerStep("NEXT_SIBLING_UPDATE", last.process.getPid(), process.getParentPid(), null, null, null, process.getPid(), process.getPid(), "P" + last.process.getPid() + ".nextSibling", null, process.getPid(), "Linked new child after final sibling");
                }
            }
        }
        size++;
        finish(true);
    }

    /** Removes the selected process and its entire descendant subtree. */
    public boolean remove(int pid) {
        begin("REMOVE", pid);
        if (root == null) { finish(false); return false; }
        Node previousRoot = null;
        Node currentRoot = root;
        while (currentRoot != null) {
            if (currentRoot.process.getPid() == pid) {
                Integer old = this.root == currentRoot ? currentRoot.process.getPid() : pid(previousRoot.nextSibling);
                if (previousRoot == null) root = currentRoot.nextSibling;
                else previousRoot.nextSibling = currentRoot.nextSibling;
                size -= count(currentRoot);
                pointerStep("NODE_REMOVAL", pid, null, null, null, old, pid(currentRoot.nextSibling), pid, previousRoot == null ? "root" : "P" + previousRoot.process.getPid() + ".nextSibling", old, pid(currentRoot.nextSibling), "Removed root and its descendant subtree"); finish(true);
                return true;
            }
            previousRoot = currentRoot;
            step("SIBLING_TRAVERSAL", currentRoot.process.getPid(), null, null, null, pid(currentRoot.nextSibling), pid(currentRoot.nextSibling), currentRoot.process.getPid(), null, "Visited root while searching for removal target"); currentRoot = currentRoot.nextSibling;
        }
        for (Node top = root; top != null; top = top.nextSibling) {
            if (removeChild(top, pid)) { finish(true); return true; }
            if (top.nextSibling != null) step("SIBLING_TRAVERSAL", top.process.getPid(), top.process.getParentPid(), pid(top.firstChild), pid(top.firstChild), pid(top.nextSibling), pid(top.nextSibling), top.process.getPid(), null, "Visited root while searching descendant branches for removal target");
        }
        finish(false); return false;
    }

    public ProcessControlBlock find(int pid) {
        begin("SEARCH", pid); Node found = findNode(pid); finish(found != null);
        return found == null ? null : found.process;
    }

    public void traversePreOrder(Consumer<ProcessControlBlock> visitor) {
        Objects.requireNonNull(visitor, "visitor");
        begin("TRAVERSE", null);
        Set<Node> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Node top = root; top != null && !visited.contains(top); top = top.nextSibling) traverse(top, visitor, visited);
        finish(true);
    }

    /** Read-only hierarchy snapshot that stops if malformed links revisit a node. */
    public List<SnapshotNode> snapshot() {
        Set<Node> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        List<SnapshotNode> result = new ArrayList<>();
        for (Node top = root; top != null && visited.add(top); top = top.nextSibling) result.add(snapshot(top, visited));
        return List.copyOf(result);
    }

    /** Bounded, read-only flat view of actual first-child/next-sibling links. */
    public List<LinkSnapshot> flatSnapshot() {
        List<LinkSnapshot> rows = new ArrayList<>(); Set<Node> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Deque<Node> pending = new ArrayDeque<>(); if (root != null) pending.push(root);
        while (!pending.isEmpty() && rows.size() < 2048) {
            Node node = pending.pop(); if (!seen.add(node)) continue;
            rows.add(new LinkSnapshot(node.process.getPid(), node.process.getName(), node.process.getState().name(),
                    node.process.getParentPid(), pid(node.firstChild), pid(node.nextSibling)));
            if (node.nextSibling != null) pending.push(node.nextSibling);
            if (node.firstChild != null) pending.push(node.firstChild);
        }
        return List.copyOf(rows);
    }
    private static Integer pid(Node node) { return node == null ? null : node.process.getPid(); }

    public record SnapshotNode(ProcessControlBlock process, List<SnapshotNode> children) {
        public SnapshotNode { children = List.copyOf(children); }
    }

    private SnapshotNode snapshot(Node node, Set<Node> visited) {
        List<SnapshotNode> children = new ArrayList<>();
        for (Node child = node.firstChild; child != null && visited.add(child); child = child.nextSibling) {
            children.add(snapshot(child, visited));
        }
        return new SnapshotNode(node.process, children);
    }

    public String displayHierarchy() {
        StringBuilder result = new StringBuilder();
        for (Node top = root; top != null; top = top.nextSibling) appendHierarchy(top, 0, result);
        return result.toString();
    }

    public int size() { return size; }
    public boolean isEmpty() { return root == null; }

    private boolean removeChild(Node parent, int pid) {
        Node previous = null;
        Node child = parent.firstChild;
        while (child != null) {
            if (child.process.getPid() == pid) {
                Integer oldFirst = pid(parent.firstChild), oldSibling = pid(child.nextSibling);
                Integer oldPreviousSibling = previous == null ? null : pid(previous.nextSibling);
                if (previous == null) parent.firstChild = child.nextSibling;
                else previous.nextSibling = child.nextSibling;
                size -= count(child);
                pointerStep("NODE_REMOVAL", pid, parent.process.getPid(), oldFirst, pid(parent.firstChild),
                        oldPreviousSibling, previous == null ? null : pid(previous.nextSibling),
                        pid, previous == null ? "P" + parent.process.getPid() + ".firstChild" : "P" + previous.process.getPid() + ".nextSibling",
                        previous == null ? oldFirst : oldPreviousSibling, previous == null ? pid(parent.firstChild) : pid(previous.nextSibling),
                        "Removed process and its descendant subtree; detached node pointed to " + (oldSibling == null ? "NULL" : "P" + oldSibling));
                return true;
            }
            if (removeChild(child, pid)) return true;
            previous = child;
            step("SIBLING_TRAVERSAL", child.process.getPid(), parent.process.getPid(), pid(child.firstChild), pid(child.firstChild), pid(child.nextSibling), pid(child.nextSibling), child.process.getPid(), null, "Visited child while locating removal target");
            child = child.nextSibling;
        }
        return false;
    }

    private int count(Node node) {
        if (node == null) return 0;
        int total = 0;
        Set<Node> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        Deque<Node> pending = new ArrayDeque<>(); pending.push(node);
        while (!pending.isEmpty()) {
            Node current = pending.pop(); if (!visited.add(current)) continue; total++;
            step("TREE_TRAVERSAL", current.process.getPid(), current.process.getParentPid(), pid(current.firstChild), pid(current.firstChild), pid(current.nextSibling), pid(current.nextSibling), current.process.getPid(), null, "Visited descendant while counting the removed subtree");
            for (Node child = current.firstChild; child != null && !visited.contains(child); child = child.nextSibling) pending.push(child);
        }
        return total;
    }

    private Node findNode(int pid) {
        Set<Node> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        for (Node top = root; top != null && visited.add(top); top = top.nextSibling) {
            Node found = findNode(top, pid);
            if (found != null) return found;
        }
        return null;
    }

    private Node findNode(Node node, int pid) {
        return findNode(node, pid, Collections.newSetFromMap(new IdentityHashMap<>()));
    }
    private Node findNode(Node node, int pid, Set<Node> visited) {
        if (node == null || !visited.add(node)) return null;
        step("NODE_SEARCH", node.process.getPid(), node.process.getParentPid(), pid(node.firstChild), pid(node.firstChild), pid(node.nextSibling), pid(node.nextSibling), node.process.getPid(), null, "Compared visited process PID during tree search");
        if (node.process.getPid() == pid) return node;
        for (Node child = node.firstChild; child != null && !visited.contains(child); child = child.nextSibling) {
            Node found = findNode(child, pid, visited);
            if (found != null) return found;
        }
        return null;
    }

    private void traverse(Node node, Consumer<ProcessControlBlock> visitor, Set<Node> visited) {
        if (node == null || !visited.add(node)) return;
        visitor.accept(node.process); step("TREE_TRAVERSAL", node.process.getPid(), node.process.getParentPid(), pid(node.firstChild), pid(node.firstChild), pid(node.nextSibling), pid(node.nextSibling), node.process.getPid(), null, "Visited process during pre-order traversal");
        for (Node child = node.firstChild; child != null && !visited.contains(child); child = child.nextSibling) traverse(child, visitor, visited);
    }

    private void appendHierarchy(Node node, int depth, StringBuilder result) {
        if (node == null) return;
        result.append("  ".repeat(depth)).append(node.process.getPid()).append(" ").append(node.process.getName()).append('\n');
        for (Node child = node.firstChild; child != null; child = child.nextSibling) appendHierarchy(child, depth + 1, result);
    }
}
