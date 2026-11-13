package com.kernelx.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveSimulationRequest(@NotBlank @Size(max = 80) String name) { }
