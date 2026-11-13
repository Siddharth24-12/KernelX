package com.kernelx.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ChangePriorityRequest(@Min(0) @Max(10) int priority) { }
