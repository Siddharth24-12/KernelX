package com.kernelx.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.ComparisonAlgorithmResult;
import com.kernelx.dto.ComparisonConfigurationRequest;
import com.kernelx.dto.ComparisonMetricWinner;
import com.kernelx.dto.ComparisonReport;
import com.kernelx.dto.RunComparisonRequest;
import com.kernelx.dto.WorkloadDefinition;
import com.kernelx.dto.WorkloadProcessDefinition;
import com.kernelx.model.ProcessMetrics;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SchedulingResult;
import com.kernelx.persistence.JsonFileRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Compares immutable workload snapshots with fresh scheduler instances; never accesses the live runtime. */
@Service
public final class ComparisonService {
    private final JsonFileRepository<ComparisonReport> repository;
    private final Function<String, WorkloadDefinition> workloadLookup;
    private final Supplier<ComparisonScheduler> schedulerFactory;

    @Autowired
    public ComparisonService(ObjectMapper mapper,
                             @Value("${kernelx.data-directory:data}") String dataDirectory,
                             WorkloadService workloads) {
        this(Path.of(dataDirectory), mapper, workloads::findById, () -> new SchedulingService()::schedule);
    }

    ComparisonService(Path dataDirectory, ObjectMapper mapper,
                      Function<String, WorkloadDefinition> workloadLookup,
                      Supplier<ComparisonScheduler> schedulerFactory) {
        repository = new JsonFileRepository<>(dataDirectory.resolve("comparisons.json"), ComparisonReport.class, mapper);
        this.workloadLookup = workloadLookup;
        this.schedulerFactory = schedulerFactory;
    }

    public synchronized ComparisonReport compare(RunComparisonRequest request) {
        validateConfigurations(request.configurations());
        WorkloadDefinition storedWorkload = workloadLookup.apply(request.workloadId());
        WorkloadDefinition snapshot = new WorkloadDefinition(storedWorkload.id(), storedWorkload.name(), storedWorkload.description(),
                storedWorkload.createdAt(), storedWorkload.updatedAt(), List.copyOf(storedWorkload.processes()),
                storedWorkload.algorithm(), storedWorkload.timeQuantum(), storedWorkload.preemptivePriority(),
                storedWorkload.totalMemory(), storedWorkload.memoryAllocationStrategy(), storedWorkload.speed());
        validateProcesses(snapshot.processes());
        List<ComparisonAlgorithmResult> results = new ArrayList<>(request.configurations().size());
        for (ComparisonConfigurationRequest configuration : request.configurations()) {
            try {
                // A fresh immutable input list and fresh SchedulingService isolate Work state and diagnostic recorders.
                List<SchedulingProcess> inputs = snapshot.processes().stream().map(ComparisonService::schedulingInput).toList();
                ComparisonScheduler isolatedScheduler = schedulerFactory.get();
                if (isolatedScheduler == null) throw new IllegalStateException("Scheduler factory returned null");
                SchedulingResult result = isolatedScheduler.schedule(inputs, configuration.algorithm(),
                        normalizedQuantum(configuration), configuration.preemptivePriority());
                results.add(toResult(configuration, result));
            } catch (RuntimeException failure) {
                throw new ComparisonExecutionException("Comparison failed while running " + configuration.label()
                        + ". No report was saved.", failure);
            }
        }

        ComparisonReport report = new ComparisonReport(UUID.randomUUID().toString(), snapshot.id(), snapshot.name(),
                Instant.now(), snapshot, results, winners(results));
        repository.append(report);
        return report;
    }

    public synchronized List<ComparisonReport> findAll() { return repository.findAll(); }

    public synchronized ComparisonReport findById(String id) {
        return repository.findAll().stream().filter(report -> report.comparisonId().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Comparison report " + id + " was not found"));
    }

    public synchronized void delete(String id) {
        if (!repository.removeIf(report -> report.comparisonId().equals(id))) {
            throw new ResourceNotFoundException("Comparison report " + id + " was not found");
        }
    }

    private void validateConfigurations(List<ComparisonConfigurationRequest> configurations) {
        if (configurations == null || configurations.size() < 2 || configurations.size() > 12) {
            throw new IllegalArgumentException("Choose between 2 and 12 scheduling configurations");
        }
        Set<String> ids = new HashSet<>();
        Set<String> signatures = new HashSet<>();
        for (ComparisonConfigurationRequest configuration : configurations) {
            if (configuration == null || configuration.configurationId() == null || configuration.configurationId().isBlank()
                    || configuration.label() == null || configuration.label().isBlank() || configuration.algorithm() == null) {
                throw new IllegalArgumentException("Every configuration requires an ID, label, and algorithm");
            }
            if (!ids.add(configuration.configurationId())) {
                throw new IllegalArgumentException("Configuration IDs must be unique");
            }
            int quantum = normalizedQuantum(configuration);
            if (configuration.algorithm() == SchedulingAlgorithm.ROUND_ROBIN) {
                if (quantum <= 0 || quantum > 100000) throw new IllegalArgumentException("Round Robin quantum must be between 1 and 100000");
            } else if (configuration.timeQuantum() != null && configuration.timeQuantum() != 0) {
                throw new IllegalArgumentException("Time quantum is only supported for Round Robin");
            }
            if (configuration.algorithm() != SchedulingAlgorithm.PRIORITY && configuration.preemptivePriority()) {
                throw new IllegalArgumentException("Preemptive mode is only supported for Priority scheduling");
            }
            String signature = configuration.algorithm() + ":" + quantum + ":" + configuration.preemptivePriority();
            if (!signatures.add(signature)) throw new IllegalArgumentException("Duplicate scheduling configurations are not allowed");
        }
    }

    private void validateProcesses(List<WorkloadProcessDefinition> processes) {
        if (processes == null || processes.isEmpty()) throw new IllegalArgumentException("Workload must contain at least one process");
        if (processes.size() > 256) throw new IllegalArgumentException("Workload cannot exceed 256 processes");
        Set<Integer> pids = new HashSet<>();
        Map<Integer, Integer> parents = new HashMap<>();
        for (WorkloadProcessDefinition process : processes) {
            if (process == null) throw new IllegalArgumentException("Workload contains an empty process definition");
            if (!pids.add(process.pid())) throw new IllegalArgumentException("Workload contains duplicate PID " + process.pid());
            // Reuse the scheduler input's domain validation for all fields that affect scheduling.
            schedulingInput(process);
            if (process.memoryRequirement() <= 0) throw new IllegalArgumentException("Memory requirements must be positive");
            int parentPid = process.parentPid() == null ? -1 : process.parentPid();
            if (parentPid < -1 || parentPid == process.pid()) throw new IllegalArgumentException("Workload contains an invalid parent PID for " + process.pid());
            parents.put(process.pid(), parentPid);
        }
        for (WorkloadProcessDefinition process : processes) {
            int parentPid = parents.get(process.pid());
            if (parentPid != -1 && !pids.contains(parentPid)) throw new IllegalArgumentException("Parent PID " + parentPid + " is missing from workload");
            Set<Integer> visited = new HashSet<>();
            int current = process.pid();
            while (current != -1 && parents.containsKey(current)) {
                if (!visited.add(current)) throw new IllegalArgumentException("Workload parent relationships contain a cycle");
                current = parents.get(current);
            }
        }
    }

    private static SchedulingProcess schedulingInput(WorkloadProcessDefinition process) {
        return new SchedulingProcess(process.pid(), process.name(), process.priority(), process.arrivalTime(), process.burstTime());
    }

    private static int normalizedQuantum(ComparisonConfigurationRequest configuration) {
        return configuration.timeQuantum() == null ? 0 : configuration.timeQuantum();
    }

    private ComparisonAlgorithmResult toResult(ComparisonConfigurationRequest configuration, SchedulingResult result) {
        int totalTime = result.totalTime();
        if (totalTime <= 0) throw new IllegalStateException("Scheduler returned a non-positive total time for a non-empty workload");
        int busyTime = result.gantt().stream().filter(segment -> !segment.idle()).mapToInt(segment -> segment.duration()).sum();
        double utilization = 100.0 * busyTime / totalTime;
        double throughput = (double) result.processes().size() / totalTime;
        return new ComparisonAlgorithmResult(configuration.configurationId(), configuration.label(), result.algorithm(),
                result.preemptive(), result.timeQuantum(), result.gantt(), result.processes(), result.averageWaitingTime(),
                result.averageTurnaroundTime(), result.averageResponseTime(), totalTime, utilization, throughput);
    }

    private List<ComparisonMetricWinner> winners(List<ComparisonAlgorithmResult> results) {
        return List.of(
                winner(results, "averageWaitingTime", "MINIMIZE", ComparisonAlgorithmResult::averageWaitingTime),
                winner(results, "averageTurnaroundTime", "MINIMIZE", ComparisonAlgorithmResult::averageTurnaroundTime),
                winner(results, "averageResponseTime", "MINIMIZE", ComparisonAlgorithmResult::averageResponseTime),
                winner(results, "cpuUtilization", "MAXIMIZE", ComparisonAlgorithmResult::cpuUtilization),
                winner(results, "throughput", "MAXIMIZE", ComparisonAlgorithmResult::throughput));
    }

    private ComparisonMetricWinner winner(List<ComparisonAlgorithmResult> results, String metric, String objective,
            java.util.function.ToDoubleFunction<ComparisonAlgorithmResult> valueOf) {
        double best = valueOf.applyAsDouble(results.getFirst());
        for (int i = 1; i < results.size(); i++) {
            double value = valueOf.applyAsDouble(results.get(i));
            if ((objective.equals("MINIMIZE") && value < best) || (objective.equals("MAXIMIZE") && value > best)) best = value;
        }
        final double bestValue = best;
        List<ComparisonAlgorithmResult> tied = results.stream()
                .filter(result -> Double.compare(valueOf.applyAsDouble(result), bestValue) == 0).toList();
        return new ComparisonMetricWinner(metric, objective, best,
                tied.stream().map(ComparisonAlgorithmResult::configurationId).toList(),
                tied.stream().map(ComparisonAlgorithmResult::label).toList());
    }
}
