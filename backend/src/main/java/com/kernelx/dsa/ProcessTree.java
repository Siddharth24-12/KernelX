package com.kernelx.dsa;

import com.kernelx.model.ProcessControlBlock;
import java.util.Objects;
import java.util.function.Consumer;

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

    public void add(ProcessControlBlock process) {
        Objects.requireNonNull(process, "process");
        if (find(process.getPid()) != null) throw new IllegalArgumentException("Duplicate PID: " + process.getPid());
        if (root == null) {
            if (process.getParentPid() != -1) throw new IllegalArgumentException("A root process must have parent PID -1");
            root = new Node(process);
        } else {
            if (process.getParentPid() == -1) {
                Node lastRoot = root;
                while (lastRoot.nextSibling != null) lastRoot = lastRoot.nextSibling;
                lastRoot.nextSibling = new Node(process);
            } else {
                Node parent = findNode(process.getParentPid());
                if (parent == null) throw new IllegalArgumentException("Parent process not found: " + process.getParentPid());
                Node child = new Node(process);
                if (parent.firstChild == null) parent.firstChild = child;
                else {
                    Node last = parent.firstChild;
                    while (last.nextSibling != null) last = last.nextSibling;
                    last.nextSibling = child;
                }
            }
        }
        size++;
    }

    /** Removes the selected process and its entire descendant subtree. */
    public boolean remove(int pid) {
        if (root == null) return false;
        Node previousRoot = null;
        Node currentRoot = root;
        while (currentRoot != null) {
            if (currentRoot.process.getPid() == pid) {
                if (previousRoot == null) root = currentRoot.nextSibling;
                else previousRoot.nextSibling = currentRoot.nextSibling;
                size -= count(currentRoot);
                return true;
            }
            previousRoot = currentRoot;
            currentRoot = currentRoot.nextSibling;
        }
        for (Node top = root; top != null; top = top.nextSibling) {
            if (removeChild(top, pid)) return true;
        }
        return false;
    }

    public ProcessControlBlock find(int pid) {
        Node found = findNode(pid);
        return found == null ? null : found.process;
    }

    public void traversePreOrder(Consumer<ProcessControlBlock> visitor) {
        Objects.requireNonNull(visitor, "visitor");
        for (Node top = root; top != null; top = top.nextSibling) traverse(top, visitor);
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
                if (previous == null) parent.firstChild = child.nextSibling;
                else previous.nextSibling = child.nextSibling;
                size -= count(child);
                return true;
            }
            if (removeChild(child, pid)) return true;
            previous = child;
            child = child.nextSibling;
        }
        return false;
    }

    private int count(Node node) {
        if (node == null) return 0;
        int total = 1;
        for (Node child = node.firstChild; child != null; child = child.nextSibling) total += count(child);
        return total;
    }

    private Node findNode(int pid) {
        for (Node top = root; top != null; top = top.nextSibling) {
            Node found = findNode(top, pid);
            if (found != null) return found;
        }
        return null;
    }

    private Node findNode(Node node, int pid) {
        if (node == null) return null;
        if (node.process.getPid() == pid) return node;
        for (Node child = node.firstChild; child != null; child = child.nextSibling) {
            Node found = findNode(child, pid);
            if (found != null) return found;
        }
        return null;
    }

    private void traverse(Node node, Consumer<ProcessControlBlock> visitor) {
        if (node == null) return;
        visitor.accept(node.process);
        for (Node child = node.firstChild; child != null; child = child.nextSibling) traverse(child, visitor);
    }

    private void appendHierarchy(Node node, int depth, StringBuilder result) {
        if (node == null) return;
        result.append("  ".repeat(depth)).append(node.process.getPid()).append(" ").append(node.process.getName()).append('\n');
        for (Node child = node.firstChild; child != null; child = child.nextSibling) appendHierarchy(child, depth + 1, result);
    }
}
