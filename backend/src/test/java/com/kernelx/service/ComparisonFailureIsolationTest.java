package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.ComparisonConfigurationRequest;
import com.kernelx.dto.RunComparisonRequest;
import com.kernelx.dto.WorkloadDefinition;
import com.kernelx.dto.WorkloadProcessDefinition;
import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class ComparisonFailureIsolationTest {
    @Test void failedAlgorithmDoesNotPersistPartialReport() throws Exception {
        Path dataDirectory = Files.createTempDirectory("kernelx-comparison-failure-");
        WorkloadDefinition workload = new WorkloadDefinition("w-1", "Failure fixture", "", Instant.EPOCH, Instant.EPOCH,
                List.of(new WorkloadProcessDefinition(81001, "one", 5, 0, 2, 16, -1)),
                SchedulingAlgorithm.FCFS, 0, false, 128, MemoryAllocationStrategy.FIRST_FIT, 1.0);
        AtomicInteger calls = new AtomicInteger();
        ComparisonService service = new ComparisonService(dataDirectory, new ObjectMapper().findAndRegisterModules(),
                ignored -> workload, () -> calls.getAndIncrement() == 0
                        ? new SchedulingService()::schedule
                        : (processes, algorithm, quantum, preemptive) -> { throw new IllegalStateException("injected isolated-run failure"); });
        RunComparisonRequest request = new RunComparisonRequest("w-1", List.of(
                new ComparisonConfigurationRequest("fcfs", "FCFS", SchedulingAlgorithm.FCFS, null, false),
                new ComparisonConfigurationRequest("sjf", "SJF", SchedulingAlgorithm.SJF, null, false)));
        ComparisonExecutionException failure = assertThrows(ComparisonExecutionException.class, () -> service.compare(request));
        assertEquals("Comparison failed while running SJF. No report was saved.", failure.getMessage());
        assertEquals(0, service.findAll().size());
    }
}
