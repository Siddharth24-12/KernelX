package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.ExperimentRequest;
import com.kernelx.dto.ExperimentType;
import com.kernelx.dto.ExperimentVariantRequest;
import com.kernelx.dto.WorkloadDefinition;
import com.kernelx.dto.WorkloadProcessDefinition;
import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ExperimentServiceTest {
    @TempDir Path directory;

    @Test void failedVariantDoesNotPersistPartialExperimentReport() throws Exception {
        WorkloadDefinition workload = workload();
        AtomicInteger calls = new AtomicInteger();
        Supplier<ComparisonScheduler> factory = () -> calls.getAndIncrement() == 0
                ? new SchedulingService()::schedule
                : (input, algorithm, quantum, preemptive) -> { throw new IllegalStateException("injected variant failure"); };
        ExperimentService service = new ExperimentService(directory, new ObjectMapper().findAndRegisterModules(), id -> workload, factory);
        ExperimentRequest request = new ExperimentRequest("failure", "", workload.id(), ExperimentType.SCHEDULING,
                List.of(new ExperimentVariantRequest("v1", "variant", SchedulingAlgorithm.SJF, null, false, List.of(), null)), null);

        assertThrows(ComparisonExecutionException.class, () -> service.execute(request));
        assertEquals(List.of(), service.findAll());
        assertEquals(0, new ObjectMapper().readTree(Files.readString(directory.resolve("experiments.json"))).size());
    }

    @Test void rejectsRoundRobinVariantWithoutQuantumBeforeRunning() {
        WorkloadDefinition workload = workload();
        ExperimentService service = new ExperimentService(directory, new ObjectMapper().findAndRegisterModules(), id -> workload,
                () -> new SchedulingService()::schedule);
        ExperimentRequest request = new ExperimentRequest("invalid", "", workload.id(), ExperimentType.SCHEDULING,
                List.of(new ExperimentVariantRequest("v1", "invalid RR", SchedulingAlgorithm.ROUND_ROBIN, null, false, List.of(), null)), null);
        assertThrows(IllegalArgumentException.class, () -> service.execute(request));
        assertEquals(List.of(), service.findAll());
    }

    private WorkloadDefinition workload() {
        return new WorkloadDefinition("saved", "Saved", "", null, null,
                List.of(new WorkloadProcessDefinition(91001, "one", 5, 0, 3, 16, -1),
                        new WorkloadProcessDefinition(91002, "two", 3, 1, 2, 16, -1)),
                SchedulingAlgorithm.FCFS, 0, false, 128, MemoryAllocationStrategy.FIRST_FIT, 1.0);
    }
}
