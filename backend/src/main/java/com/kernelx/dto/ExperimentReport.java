package com.kernelx.dto;

import java.time.Instant;
import java.util.List;

public record ExperimentReport(String experimentId, String name, String description, ExperimentType type,
                               String baseWorkloadId, String baseWorkloadName, Instant executedAt,
                               WorkloadDefinition workloadSnapshot, ExperimentVariantResult baseline,
                               List<ExperimentVariantResult> variants,
                               List<ExperimentMetricComparison> metricComparisons,
                               List<ProcessMetricDelta> processMetricDeltas,
                               List<ComparisonMetricWinner> winners) {
    public ExperimentReport {
        variants = List.copyOf(variants);
        metricComparisons = List.copyOf(metricComparisons);
        processMetricDeltas = List.copyOf(processMetricDeltas);
        winners = List.copyOf(winners);
    }
}
