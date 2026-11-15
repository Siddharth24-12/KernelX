package com.kernelx.dsa;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class CustomHashTableTest {
    private record CollisionKey(String value) {
        @Override public int hashCode() { return 7; }
    }

    @Test void handlesCollisionsReplacementRemovalAndMissingKeys() {
        CustomHashTable<CollisionKey, String> table = new CustomHashTable<>(2);
        CollisionKey a = new CollisionKey("a"), b = new CollisionKey("b"), c = new CollisionKey("c");
        assertNull(table.put(a, "one"));
        assertNull(table.put(b, "two"));
        assertEquals("one", table.get(a));
        assertEquals("two", table.get(b));
        assertEquals("one", table.put(a, "updated"));
        assertEquals("updated", table.get(a));
        assertEquals("two", table.remove(b));
        assertNull(table.get(b));
        assertNull(table.remove(c));
        assertEquals(1, table.size());
    }

    @Test void resizesAndRetainsAllEntries() {
        CustomHashTable<Integer, String> table = new CustomHashTable<>(2);
        for (int i = 0; i < 100; i++) table.put(i, "v" + i);
        assertTrue(table.capacity() > 2);
        assertEquals(100, table.size());
        for (int i = 0; i < 100; i++) assertEquals("v" + i, table.get(i));
        assertThrows(NullPointerException.class, () -> table.put(null, "x"));
        assertThrows(NullPointerException.class, () -> table.put(1, null));
    }

    @Test void diagnosticSnapshotsExposeActualChainsWithoutCallingObserverAndResizeRecordsRehashes() {
        java.util.List<String> operations = new java.util.ArrayList<>();
        CustomHashTable.Observer<Integer, String> observer = new CustomHashTable.Observer<>() {
            @Override public CustomHashTable.Operation<Integer, String> begin(String tableId, String kind, Integer key,
                    int hash, int bucket, int capacity, CustomHashTable.BucketSnapshot<Integer, String> before,
                    CustomHashTable.Snapshot<Integer, String> tableBefore) {
                operations.add(kind + ":" + key);
                return new CustomHashTable.Operation<>() {
                    @Override public void collision(int index, int length, int position, int spreadHash) { operations.add("COLLISION:" + index + ":" + length); }
                    @Override public void resizeStarted(int oldCapacity, int newCapacity, int size) { operations.add("RESIZE:" + oldCapacity + ":" + newCapacity); }
                    @Override public void rehashed(CustomHashTable.EntrySnapshot<Integer, String> entry, int oldIndex, int newIndex,
                            Long oldNext, Long newNext, Long oldHead, Long newHead) { operations.add("REHASH:" + entry.key() + ":" + oldIndex + ":" + newIndex); }
                };
            }
        };
        CustomHashTable<Integer, String> table = new CustomHashTable<>(observer);
        table.put(1, "one"); table.put(17, "seventeen");
        var live = table.snapshot(); int tracesBefore = operations.size();
        assertEquals(16, live.capacity());
        assertEquals(java.util.List.of(17, 1), live.buckets().get(1).entries().stream().map(CustomHashTable.EntrySnapshot::key).toList());
        for (int i = 0; i < 5; i++) assertEquals(live, table.snapshot());
        assertEquals(tracesBefore, operations.size(), "snapshot must not invoke operation instrumentation");
        for (int i = 0; i < 11; i++) table.put(100 + i, "v" + i);
        assertEquals(32, table.capacity());
        assertTrue(operations.contains("RESIZE:16:32"));
        assertTrue(operations.stream().anyMatch(value -> value.startsWith("REHASH:")));
        assertEquals(13, table.size());
        for (int i = 0; i < 11; i++) assertEquals("v" + i, table.get(100 + i));
    }
}
