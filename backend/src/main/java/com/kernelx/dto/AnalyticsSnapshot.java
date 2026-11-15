package com.kernelx.dto;

import java.time.Instant;

public record AnalyticsSnapshot(Instant capturedAt, CpuObservatorySnapshot cpu,
                                MemoryObservatorySnapshot memory,
                                ProcessObservatorySnapshot processes) { }
