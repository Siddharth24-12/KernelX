package com.kernelx.dto;

import java.time.Instant;
import java.util.List;

public record ComparisonReport(String comparisonId, String workloadId, String workloadName,
                               Instant createdAt, WorkloadDefinition workloadSnapshot,
                               List<ComparisonAlgorithmResult> results,
                               List<ComparisonMetricWinner> winners) {
    public ComparisonReport {
        results = List.copyOf(results);
        winners = List.copyOf(winners);
    }
}
