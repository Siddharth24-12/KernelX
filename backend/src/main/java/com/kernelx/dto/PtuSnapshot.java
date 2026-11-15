package com.kernelx.dto;
import java.util.List;
public record PtuSnapshot(int size, int rootCount, List<Integer> rootPids, List<PtuNodeSnapshot> nodes, boolean truncated) {
    public PtuSnapshot { rootPids = List.copyOf(rootPids); nodes = List.copyOf(nodes); }
}
