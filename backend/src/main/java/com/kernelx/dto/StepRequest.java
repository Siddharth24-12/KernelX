package com.kernelx.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record StepRequest(@Min(1) @Max(100000) Integer ticks) {
    public int tickCount() { return ticks == null ? 1 : ticks; }
}
