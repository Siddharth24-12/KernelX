package com.kernelx.dsa;

import java.util.Objects;

/** Separate-chaining hash table with power-of-two growth and 0.75 load factor. */
public final class CustomHashTable<K, V> {
    private static final int DEFAULT_CAPACITY = 16;
    private static final float LOAD_FACTOR = 0.75f;

    private static final class Node<K, V> {
        private final K key;
        private V value;
        private Node<K, V> next;
        private Node(K key, V value, Node<K, V> next) { this.key = key; this.value = value; this.next = next; }
    }

    private Node<K, V>[] buckets;
    private int size;

    public CustomHashTable() { this(DEFAULT_CAPACITY); }

    @SuppressWarnings("unchecked")
    public CustomHashTable(int initialCapacity) {
        if (initialCapacity < 1) throw new IllegalArgumentException("Initial capacity must be positive");
        int capacity = 1;
        while (capacity < initialCapacity) capacity <<= 1;
        buckets = (Node<K, V>[]) new Node[capacity];
    }

    /** Adds or replaces a mapping; returns its previous value, or null if new. */
    public V put(K key, V value) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        int index = index(key, buckets.length);
        for (Node<K, V> node = buckets[index]; node != null; node = node.next) {
            if (node.key.equals(key)) { V previous = node.value; node.value = value; return previous; }
        }
        buckets[index] = new Node<>(key, value, buckets[index]);
        size++;
        if ((float) size / buckets.length > LOAD_FACTOR) resize();
        return null;
    }

    public V get(K key) {
        Objects.requireNonNull(key, "key");
        for (Node<K, V> node = buckets[index(key, buckets.length)]; node != null; node = node.next) {
            if (node.key.equals(key)) return node.value;
        }
        return null;
    }

    public V remove(K key) {
        Objects.requireNonNull(key, "key");
        int index = index(key, buckets.length);
        Node<K, V> previous = null;
        Node<K, V> current = buckets[index];
        while (current != null) {
            if (current.key.equals(key)) {
                if (previous == null) buckets[index] = current.next;
                else previous.next = current.next;
                size--;
                return current.value;
            }
            previous = current;
            current = current.next;
        }
        return null;
    }

    public int size() { return size; }
    public int capacity() { return buckets.length; }
    public boolean isEmpty() { return size == 0; }

    private int index(K key, int capacity) {
        int hash = key.hashCode();
        hash ^= hash >>> 16;
        return hash & (capacity - 1);
    }

    @SuppressWarnings("unchecked")
    private void resize() {
        Node<K, V>[] expanded = (Node<K, V>[]) new Node[buckets.length * 2];
        for (Node<K, V> bucket : buckets) {
            Node<K, V> node = bucket;
            while (node != null) {
                Node<K, V> next = node.next;
                int newIndex = index(node.key, expanded.length);
                node.next = expanded[newIndex];
                expanded[newIndex] = node;
                node = next;
            }
        }
        buckets = expanded;
    }
}
