package com.kernelx.dto;

public record FpbLiveSnapshot(boolean active, FpbQueueSnapshot queue, String message) { }
