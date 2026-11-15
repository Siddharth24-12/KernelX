package com.kernelx.dto;

public record AluTraceStep(long sequence, String kind, Integer pid, Long entryId,
                           Integer bucketIndex, Integer oldBucketIndex, Integer newBucketIndex,
                           Integer chainPosition, Integer collisionChainLength, Integer spreadHash,
                           Integer oldCapacity, Integer newCapacity,
                           Long ownerEntryId, Long oldNextEntryId, Long newNextEntryId,
                           Long oldBucketHeadEntryId, Long newBucketHeadEntryId,
                           Boolean result, AluEntrySnapshot entry, String description) { }
