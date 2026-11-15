package com.kernelx.dto;

import java.util.List;

public record AluTableSnapshot(String tableId, int capacity, int size, double loadFactor,
                               List<AluBucketSnapshot> buckets, boolean truncated) {
    public AluTableSnapshot { buckets = List.copyOf(buckets); }
}
