package com.kernelx.service;

import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.MemoryBlockView;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.SystemEventType;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Contiguous variable-size memory arena. Each allocation/deallocation is O(n) in block count. */
public final class MemoryManager {
    private static final class Block {
        private int start;
        private int size;
        private Integer pid;
        private Block next;
        private Block(int start, int size, Integer pid) { this.start = start; this.size = size; this.pid = pid; }
        private boolean isFree() { return pid == null; }
    }

    private final int totalMemory;
    private final EventManager events;
    private Block head;
    private int allocated;

    public MemoryManager(int totalMemory, EventManager events) {
        if (totalMemory <= 0) throw new IllegalArgumentException("Total memory must be positive");
        this.totalMemory = totalMemory;
        this.events = Objects.requireNonNull(events, "events");
        this.head = new Block(0, totalMemory, null);
    }

    /** Returns false for insufficient contiguous space. PID must not already own a block. */
    public synchronized boolean allocate(int pid, int amount, MemoryAllocationStrategy strategy) {
        if (pid <= 0) throw new IllegalArgumentException("PID must be positive");
        if (amount <= 0) throw new IllegalArgumentException("Allocation size must be positive");
        Objects.requireNonNull(strategy, "strategy");
        if (findAllocated(pid) != null) throw new IllegalStateException("PID already has allocated memory: " + pid);

        Block candidate = null;
        for (Block block = head; block != null; block = block.next) {
            if (!block.isFree() || block.size < amount) continue;
            if (strategy == MemoryAllocationStrategy.FIRST_FIT) { candidate = block; break; }
            if (candidate == null
                    || (strategy == MemoryAllocationStrategy.BEST_FIT && block.size < candidate.size)
                    || (strategy == MemoryAllocationStrategy.WORST_FIT && block.size > candidate.size)) {
                candidate = block;
            }
        }
        if (candidate == null) {
            events.record(pid, SystemEventType.MEMORY_ALLOCATION_FAILED,
                    "Could not allocate " + amount + " memory units using " + strategy + ": no contiguous free block was large enough");
            return false;
        }

        if (candidate.size > amount) {
            Block remainder = new Block(candidate.start + amount, candidate.size - amount, null);
            remainder.next = candidate.next;
            candidate.next = remainder;
            candidate.size = amount;
        }
        candidate.pid = pid;
        allocated += amount;
        events.record(pid, SystemEventType.MEMORY_ALLOCATED,
                "Allocated " + amount + " memory units at address " + candidate.start + " using " + strategy);
        return true;
    }

    public synchronized boolean deallocate(int pid) {
        Block block = findAllocated(pid);
        if (block == null) return false;
        int released = block.size;
        block.pid = null;
        allocated -= released;
        mergeAdjacentFreeBlocks();
        events.record(pid, SystemEventType.MEMORY_DEALLOCATED, "Released " + released + " memory units");
        return true;
    }

    public synchronized boolean isAllocated(int pid) { return findAllocated(pid) != null; }

    public synchronized MemorySnapshot snapshot() {
        List<MemoryBlockView> blocks = new ArrayList<>();
        for (Block block = head; block != null; block = block.next) {
            blocks.add(new MemoryBlockView(block.start, block.size, block.pid, block.isFree()));
        }
        return new MemorySnapshot(totalMemory, allocated, totalMemory - allocated, blocks);
    }

    public synchronized void reset() {
        for (Block block = head; block != null; block = block.next) {
            if (!block.isFree()) events.record(block.pid, SystemEventType.MEMORY_DEALLOCATED,
                    "Released " + block.size + " memory units during simulation reset");
        }
        head = new Block(0, totalMemory, null);
        allocated = 0;
    }

    private Block findAllocated(int pid) {
        for (Block block = head; block != null; block = block.next) {
            if (!block.isFree() && block.pid == pid) return block;
        }
        return null;
    }

    private void mergeAdjacentFreeBlocks() {
        Block block = head;
        while (block != null && block.next != null) {
            if (block.isFree() && block.next.isFree()) {
                block.size += block.next.size;
                block.next = block.next.next;
            } else {
                block = block.next;
            }
        }
    }
}
