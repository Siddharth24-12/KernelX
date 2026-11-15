package com.kernelx.dto;

import java.util.List;

public record AluBucketSnapshot(int index, int chainLength, List<AluEntrySnapshot> entries, boolean truncated) {
    public AluBucketSnapshot { entries = List.copyOf(entries); }
}
