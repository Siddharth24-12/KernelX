package com.kernelx.dto;

public record ExperimentMetricComparison(String variantId, String variantLabel, String metric,
                                         double baselineValue, double variantValue,
                                         double difference, double absoluteDifference, Double percentageChange) { }
