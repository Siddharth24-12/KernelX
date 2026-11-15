package com.kernelx.dto;

import java.util.List;

public record WorkloadLoadResponse(String workloadId, List<ProcessResponse> processes) { }
