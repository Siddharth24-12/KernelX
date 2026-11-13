package com.kernelx.model;

public record SystemEvent(long eventId, int simulationTime, Integer pid, SystemEventType type, String description) { }
