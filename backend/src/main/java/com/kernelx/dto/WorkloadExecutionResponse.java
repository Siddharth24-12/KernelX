package com.kernelx.dto;

import com.kernelx.model.SimulationSnapshot;
import java.util.List;

public record WorkloadExecutionResponse(String workloadId, List<Integer> createdPids, SimulationSnapshot simulation) { }
