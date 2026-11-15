package com.kernelx.dto;

import java.util.List;

public record ExperimentVariantResult(String variantId, String label, ExperimentConfiguration configuration,
                                      List<String> parameterChanges, ComparisonAlgorithmResult schedulingResult,
                                      MemoryVariantResult memoryResult) {
    public ExperimentVariantResult { parameterChanges = List.copyOf(parameterChanges); }
}
