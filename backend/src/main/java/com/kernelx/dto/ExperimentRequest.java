package com.kernelx.dto;

import java.util.List;

public record ExperimentRequest(String name, String description, String baseWorkloadId, ExperimentType type,
                                List<ExperimentVariantRequest> variants,
                                List<MemoryExperimentOperation> memoryOperations) { }
