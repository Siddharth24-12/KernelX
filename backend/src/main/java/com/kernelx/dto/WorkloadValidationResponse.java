package com.kernelx.dto;

import java.util.List;

public record WorkloadValidationResponse(boolean valid, List<String> errors, List<String> warnings) { }
