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
}
