package com.kernelx.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record RunComparisonRequest(
        @NotBlank String workloadId,
        @NotEmpty @Size(min = 2, max = 12) List<@Valid ComparisonConfigurationRequest> configurations) { }
