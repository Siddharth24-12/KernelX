package com.kernelx.dsa;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Separate-chaining hash table with power-of-two growth and 0.75 load factor. */
public final class CustomHashTable<K, V> {
    private static final int DEFAULT_CAPACITY = 16;
    private static final float LOAD_FACTOR = 0.75f;
    private static final Operation<Object, Object> NO_OP = new Operation<>() { };
    private static final Observer<Object, Object> NO_OBSERVER = new Observer<>() { };

    private static final class Node<K, V> {
        private final long nodeId;
        private final K key;
        private V value;
        private Node<K, V> next;
        private Node(long nodeId, K key, V value, Node<K, V> next) {
            this.nodeId = nodeId; this.key = key; this.value = value; this.next = next;
        }
    }

    /** Immutable logical entry view. The value is internal to the DSA caller and is never an API DTO. */
    public record EntrySnapshot<K, V>(long nodeId, K key, V value, Long nextNodeId) { }

    public record BucketSnapshot<K, V>(int index, List<EntrySnapshot<K, V>> entries) {
        public BucketSnapshot { entries = List.copyOf(entries); }
    }

    /** Direct bucket-array read; does not call a table operation or an observer. */
    public record Snapshot<K, V>(String tableId, int capacity, int size, double loadFactor,
                                 List<BucketSnapshot<K, V>> buckets) {
        public Snapshot { buckets = List.copyOf(buckets); }
    }

    /** Observer callbacks align with real hashing, chain visits, link mutations, and rehashing. */
    public interface Observer<K, V> {
        default Operation<K, V> begin(String tableId, String kind, K key, int spreadHash, int bucketIndex, int capacity,
                                      BucketSnapshot<K, V> bucketBefore, Snapshot<K, V> tableBefore) { return noOp(); }
    }

    public interface Operation<K, V> {
        default void nodeVisited(EntrySnapshot<K, V> entry, int bucketIndex, int chainPosition) { }
        default void keyCompared(EntrySnapshot<K, V> entry, int bucketIndex, int chainPosition, boolean matched) { }
        default void collision(int bucketIndex, int chainLength, int insertionPosition, int spreadHash) { }
        default void nodeCreated(EntrySnapshot<K, V> entry, int bucketIndex, int chainPosition) { }
        default void bucketHeadUpdated(int bucketIndex, Long oldHeadNodeId, Long newHeadNodeId) { }
        default void nextPointerUpdated(long ownerNodeId, int bucketIndex, int chainPosition,
                                        Long oldNextNodeId, Long newNextNodeId) { }
        default void valueReplaced(EntrySnapshot<K, V> entry, V previousValue) { }
        default void entryRemoved(EntrySnapshot<K, V> entry, int bucketIndex, int chainPosition) { }
        default void resizeStarted(int oldCapacity, int newCapacity, int size) { }
        default void rehashed(EntrySnapshot<K, V> entry, int oldBucketIndex, int newBucketIndex,
                             Long oldNextNodeId, Long newNextNodeId,
                             Long oldNewBucketHeadNodeId, Long newBucketHeadNodeId) { }
        default void resizeCompleted(Snapshot<K, V> resultingTable) { }
        default void completed(boolean found, String description, BucketSnapshot<K, V> bucketAfter,
                               Snapshot<K, V> tableAfter) { }
    }

    private Node<K, V>[] buckets;
    private int size;
    private long nextNodeId = 1;
    private final String tableId = UUID.randomUUID().toString();
    private final Observer<K, V> observer;

    @SuppressWarnings("unchecked")
    public CustomHashTable() { this(DEFAULT_CAPACITY, (Observer<K, V>) NO_OBSERVER); }

    public CustomHashTable(Observer<K, V> observer) { this(DEFAULT_CAPACITY, observer); }

    @SuppressWarnings("unchecked")
    public CustomHashTable(int initialCapacity) { this(initialCapacity, (Observer<K, V>) NO_OBSERVER); }

    @SuppressWarnings("unchecked")
    public CustomHashTable(int initialCapacity, Observer<K, V> observer) {
        if (initialCapacity < 1) throw new IllegalArgumentException("Initial capacity must be positive");
        Objects.requireNonNull(observer, "observer");
        this.observer = observer;
        int capacity = 1;
        while (capacity < initialCapacity) capacity <<= 1;
        buckets = (Node<K, V>[]) new Node[capacity];
    }

    /** Adds or replaces a mapping; returns its previous value, or null if new. */
    public V put(K key, V value) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        int spreadHash = spreadHash(key);
        int index = spreadHash & (buckets.length - 1);
        boolean observed = isObserved();
        Operation<K, V> operation = observer.begin(tableId, "PUT", key, spreadHash, index, buckets.length,
                observed ? bucketSnapshot(index) : null, observed ? snapshot() : null);
        int chainLength = 0;
        for (Node<K, V> node = buckets[index]; node != null; node = node.next) {
            EntrySnapshot<K, V> entry = entrySnapshot(node);
            operation.nodeVisited(entry, index, chainLength);
            boolean matched = node.key.equals(key);
            operation.keyCompared(entry, index, chainLength, matched);
            if (matched) {
                V previous = node.value;
                node.value = value;
                operation.valueReplaced(entrySnapshot(node), previous);
                operation.completed(true, "Replaced existing key in bucket " + index,
                        observed ? bucketSnapshot(index) : null, observed ? snapshot() : null);
                return previous;
            }
            chainLength++;
        }

        if (chainLength > 0) operation.collision(index, chainLength, 0, spreadHash);
        Long oldHead = nodeId(buckets[index]);
        Node<K, V> node = new Node<>(nextNodeId++, key, value, buckets[index]);
        operation.nodeCreated(entrySnapshot(node), index, 0);
        buckets[index] = node;
        operation.bucketHeadUpdated(index, oldHead, node.nodeId);
        size++;
        if ((float) size / buckets.length > LOAD_FACTOR) resize(operation);
        operation.completed(true, "Inserted new key at bucket " + index + " chain head",
                observed ? bucketSnapshot(index) : null, observed ? snapshot() : null);
        return null;
    }

    public V get(K key) {
        Objects.requireNonNull(key, "key");
        int spreadHash = spreadHash(key);
        int index = spreadHash & (buckets.length - 1);
        boolean observed = isObserved();
        Operation<K, V> operation = observer.begin(tableId, "GET", key, spreadHash, index, buckets.length,
                observed ? bucketSnapshot(index) : null, null);
        int position = 0;
        for (Node<K, V> node = buckets[index]; node != null; node = node.next, position++) {
            EntrySnapshot<K, V> entry = entrySnapshot(node);
            operation.nodeVisited(entry, index, position);
            boolean matched = node.key.equals(key);
            operation.keyCompared(entry, index, position, matched);
            if (matched) {
                operation.completed(true, "Found key at bucket " + index + " chain position " + position,
                        observed ? bucketSnapshot(index) : null, null);
                return node.value;
            }
        }
        operation.completed(false, "Key was not present in bucket " + index,
                observed ? bucketSnapshot(index) : null, null);
        return null;
    }

    public V remove(K key) {
        Objects.requireNonNull(key, "key");
        int spreadHash = spreadHash(key);
        int index = spreadHash & (buckets.length - 1);
        boolean observed = isObserved();
        Operation<K, V> operation = observer.begin(tableId, "REMOVE", key, spreadHash, index, buckets.length,
                observed ? bucketSnapshot(index) : null, observed ? snapshot() : null);
        Node<K, V> previous = null;
        Node<K, V> current = buckets[index];
        int position = 0;
        while (current != null) {
            EntrySnapshot<K, V> entry = entrySnapshot(current);
            operation.nodeVisited(entry, index, position);
            boolean matched = current.key.equals(key);
            operation.keyCompared(entry, index, position, matched);
            if (matched) {
                if (previous == null) {
                    Long oldHead = current.nodeId;
                    buckets[index] = current.next;
                    operation.bucketHeadUpdated(index, oldHead, nodeId(buckets[index]));
                } else {
                    Long oldNext = nodeId(previous.next);
                    previous.next = current.next;
                    operation.nextPointerUpdated(previous.nodeId, index, position - 1, oldNext, nodeId(previous.next));
                }
                size--;
                operation.entryRemoved(entry, index, position);
                operation.completed(true, "Removed key from bucket " + index + " chain position " + position,
                        observed ? bucketSnapshot(index) : null, observed ? snapshot() : null);
                return current.value;
            }
            previous = current;
            current = current.next;
            position++;
        }
        operation.completed(false, "Key was not present in bucket " + index,
                observed ? bucketSnapshot(index) : null, observed ? snapshot() : null);
        return null;
    }

    public int size() { return size; }
    public int capacity() { return buckets.length; }
    public boolean isEmpty() { return size == 0; }

    /** Direct table view; walks bucket arrays and links without invoking observer callbacks. */
    public Snapshot<K, V> snapshot() {
        List<BucketSnapshot<K, V>> result = new ArrayList<>(buckets.length);
        for (int index = 0; index < buckets.length; index++) result.add(bucketSnapshot(index));
        return new Snapshot<>(tableId, buckets.length, size, (double) size / buckets.length, result);
    }

    private void resize(Operation<K, V> operation) {
        int oldCapacity = buckets.length;
        Node<K, V>[] oldBuckets = buckets;
        @SuppressWarnings("unchecked") Node<K, V>[] expanded = (Node<K, V>[]) new Node[oldCapacity * 2];
        operation.resizeStarted(oldCapacity, expanded.length, size);
        for (int oldIndex = 0; oldIndex < oldBuckets.length; oldIndex++) {
            Node<K, V> node = oldBuckets[oldIndex];
            while (node != null) {
                Node<K, V> next = node.next;
                int newIndex = spreadHash(node.key) & (expanded.length - 1);
                Long oldNext = nodeId(next);
                Long oldNewBucketHead = nodeId(expanded[newIndex]);
                node.next = expanded[newIndex];
                expanded[newIndex] = node;
                operation.rehashed(entrySnapshot(node), oldIndex, newIndex, oldNext, nodeId(node.next),
                        oldNewBucketHead, node.nodeId);
                node = next;
            }
        }
        buckets = expanded;
        operation.resizeCompleted(isObserved() ? snapshot() : null);
    }

    private BucketSnapshot<K, V> bucketSnapshot(int index) {
        List<EntrySnapshot<K, V>> entries = new ArrayList<>();
        for (Node<K, V> node = buckets[index]; node != null; node = node.next) entries.add(entrySnapshot(node));
        return new BucketSnapshot<>(index, entries);
    }

    private EntrySnapshot<K, V> entrySnapshot(Node<K, V> node) {
        return new EntrySnapshot<>(node.nodeId, node.key, node.value, nodeId(node.next));
    }

    private static <K, V> Long nodeId(Node<K, V> node) { return node == null ? null : node.nodeId; }
    private static int spreadHash(Object key) {
        int hash = key.hashCode();
        return hash ^ (hash >>> 16);
    }

    private boolean isObserved() { return observer != NO_OBSERVER; }

    @SuppressWarnings("unchecked")
    private static <K, V> Operation<K, V> noOp() { return (Operation<K, V>) NO_OP; }
}
