package com.kernelx.dto;

import java.util.List;

public record ComparisonMetricWinner(String metric, String objective, double value,
                                     List<String> configurationIds, List<String> labels) {
    public ComparisonMetricWinner {
        configurationIds = List.copyOf(configurationIds);
        labels = List.copyOf(labels);
    }
}
