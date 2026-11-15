package com.kernelx.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.ComparisonAlgorithmResult;
import com.kernelx.dto.ComparisonMetricWinner;
import com.kernelx.dto.ExperimentConfiguration;
import com.kernelx.dto.ExperimentMetricComparison;
import com.kernelx.dto.ExperimentReport;
import com.kernelx.dto.ExperimentRequest;
import com.kernelx.dto.ExperimentType;
import com.kernelx.dto.ExperimentVariantRequest;
import com.kernelx.dto.ExperimentVariantResult;
import com.kernelx.dto.MemoryExperimentOperation;
import com.kernelx.dto.MemoryOperationResult;
import com.kernelx.dto.MemoryVariantResult;
import com.kernelx.dto.ProcessMetricDelta;
import com.kernelx.dto.WorkloadDefinition;
import com.kernelx.dto.WorkloadProcessDefinition;
import com.kernelx.model.GanttSegment;
import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.MemoryBlockView;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.ProcessMetrics;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SchedulingResult;
import com.kernelx.persistence.JsonFileRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Runs controlled workload experiments in isolated scheduler or memory contexts. */
@Service
public final class ExperimentService {
    private static final int MAX_VARIANTS = 12;
    private static final int MAX_MEMORY_OPERATIONS = 512;
    private final JsonFileRepository<ExperimentReport> repository;
    private final Function<String, WorkloadDefinition> workloadLookup;
    private final Supplier<ComparisonScheduler> schedulerFactory;

    @Autowired
    public ExperimentService(ObjectMapper mapper,
                             @Value("${kernelx.data-directory:data}") String dataDirectory,
                             WorkloadService workloads) {
        this(Path.of(dataDirectory), mapper, workloads::findById, () -> new SchedulingService()::schedule);
    }

    ExperimentService(Path dataDirectory, ObjectMapper mapper,
                      Function<String, WorkloadDefinition> workloadLookup,
                      Supplier<ComparisonScheduler> schedulerFactory) {
        repository = new JsonFileRepository<>(dataDirectory.resolve("experiments.json"), ExperimentReport.class, mapper);
        this.workloadLookup = workloadLookup;
        this.schedulerFactory = schedulerFactory;
    }

    public synchronized ExperimentReport execute(ExperimentRequest request) {
        validate(request);
        WorkloadDefinition source = workloadLookup.apply(request.baseWorkloadId());
        WorkloadDefinition snapshot = immutableCopy(source);
        List<ExperimentVariantResult> variants;
        ExperimentVariantResult baseline;
        if (request.type() == ExperimentType.SCHEDULING) {
            baseline = runSchedulingBaseline(snapshot);
            variants = request.variants().stream().map(variant -> runSchedulingVariant(snapshot, variant)).toList();
        } else {
            baseline = runMemory(snapshot.totalMemory(), request.memoryOperations(), "baseline", "First Fit",
                    MemoryAllocationStrategy.FIRST_FIT, List.of());
            variants = request.variants().stream().map(variant -> runMemory(snapshot.totalMemory(), request.memoryOperations(),
                    variant.variantId(), variant.label(), variant.memoryStrategy(), List.of(
                            "Memory strategy: FIRST_FIT → " + variant.memoryStrategy()))).toList();
        }
        List<ExperimentMetricComparison> metricDeltas = metricDeltas(request.type(), baseline, variants);
        List<ProcessMetricDelta> processDeltas = request.type() == ExperimentType.SCHEDULING
                ? processDeltas(baseline, variants) : List.of();
        List<ComparisonMetricWinner> metricWinners = winners(request.type(), baseline, variants);
        ExperimentReport report = new ExperimentReport(UUID.randomUUID().toString(), request.name().trim(),
                request.description() == null ? "" : request.description().trim(), request.type(), snapshot.id(),
                snapshot.name(), Instant.now(), snapshot, baseline, variants, metricDeltas, processDeltas, metricWinners);
        repository.append(report);
        return report;
    }

    public synchronized List<ExperimentReport> findAll() { return repository.findAll(); }

    public synchronized ExperimentReport findById(String id) {
        return repository.findAll().stream().filter(report -> report.experimentId().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Experiment report " + id + " was not found"));
    }

    public synchronized void delete(String id) {
        if (!repository.removeIf(report -> report.experimentId().equals(id))) {
            throw new ResourceNotFoundException("Experiment report " + id + " was not found");
        }
    }

    private void validate(ExperimentRequest request) {
        if (request == null) throw new IllegalArgumentException("Request body is required");
        if (request.name() == null || request.name().isBlank() || request.name().trim().length() > 100)
            throw new IllegalArgumentException("Experiment name is required and must not exceed 100 characters");
        if (request.baseWorkloadId() == null || request.baseWorkloadId().isBlank())
            throw new IllegalArgumentException("Choose a saved workload");
        if (request.type() == null) throw new IllegalArgumentException("Experiment type is required");
        if (request.variants() == null || request.variants().isEmpty() || request.variants().size() > MAX_VARIANTS)
            throw new IllegalArgumentException("Choose between 1 and " + MAX_VARIANTS + " experiment variants");
        WorkloadDefinition workload = workloadLookup.apply(request.baseWorkloadId());
        validateWorkload(workload);
        Set<String> ids = new HashSet<>();
        if (request.type() == ExperimentType.SCHEDULING) {
            if (request.memoryOperations() != null && !request.memoryOperations().isEmpty())
                throw new IllegalArgumentException("Memory operations are only supported for memory experiments");
            Set<String> schedulingSignatures = new HashSet<>();
            for (ExperimentVariantRequest variant : request.variants()) {
                validateVariantIdentity(variant, ids);
                if (variant.algorithm() == null || variant.memoryStrategy() != null)
                    throw new IllegalArgumentException("Scheduling variants require an algorithm and cannot specify a memory strategy");
                validateAlgorithm(variant.algorithm(), variant.timeQuantum(), Boolean.TRUE.equals(variant.preemptivePriority()));
                if (variant.processChanges() != null) {
                    Set<Integer> pids = new HashSet<>();
                    for (var change : variant.processChanges()) {
                        if (change == null || change.pid() == null || !pids.add(change.pid()))
                            throw new IllegalArgumentException("Each process change requires a unique PID");
                        WorkloadProcessDefinition process = workload.processes().stream().filter(row -> row.pid() == change.pid())
                                .findFirst().orElseThrow(() -> new IllegalArgumentException("PID " + change.pid() + " is not in the base workload"));
                        int arrival = change.arrivalTime() == null ? process.arrivalTime() : change.arrivalTime();
                        int burst = change.burstTime() == null ? process.burstTime() : change.burstTime();
                        int priority = change.priority() == null ? process.priority() : change.priority();
                        if (arrival < 0 || burst <= 0 || priority < 0 || priority > 10)
                            throw new IllegalArgumentException("Process changes require arrival ≥ 0, burst > 0, and priority 0–10");
                    }
                }
                String signature = schedulingSignature(workload, variant);
                if (signature.equals(schedulingSignature(workload, null)))
                    throw new IllegalArgumentException("Variant " + variant.label() + " does not change the baseline configuration or process parameters");
                if (!schedulingSignatures.add(signature))
                    throw new IllegalArgumentException("Scheduling variants must have distinct parameter combinations");
            }
        } else {
            if (request.memoryOperations() == null || request.memoryOperations().isEmpty()
                    || request.memoryOperations().size() > MAX_MEMORY_OPERATIONS)
                throw new IllegalArgumentException("Memory experiments require between 1 and " + MAX_MEMORY_OPERATIONS + " ordered operations");
            if (workload.totalMemory() <= 0) throw new IllegalArgumentException("The workload must define positive initial memory");
            Set<MemoryAllocationStrategy> strategies = new HashSet<>();
            for (ExperimentVariantRequest variant : request.variants()) {
                validateVariantIdentity(variant, ids);
                if (variant.memoryStrategy() == null || variant.algorithm() != null || variant.processChanges() != null && !variant.processChanges().isEmpty())
                    throw new IllegalArgumentException("Memory variants require only a memory strategy");
                if (!strategies.add(variant.memoryStrategy()) || variant.memoryStrategy() == MemoryAllocationStrategy.FIRST_FIT)
                    throw new IllegalArgumentException("Memory variants must uniquely select Best Fit and/or Worst Fit; First Fit is the baseline");
            }
            if (!strategies.contains(MemoryAllocationStrategy.BEST_FIT) || !strategies.contains(MemoryAllocationStrategy.WORST_FIT))
                throw new IllegalArgumentException("Memory experiments must include both Best Fit and Worst Fit beside the First Fit baseline");
            Set<Integer> allocated = new HashSet<>();
            Set<Integer> knownPids = new HashSet<>();
            for (int i = 0; i < request.memoryOperations().size(); i++) {
                MemoryExperimentOperation operation = request.memoryOperations().get(i);
                if (operation == null || operation.operation() == null || operation.pid() == null || operation.pid() <= 0)
                    throw new IllegalArgumentException("Every memory operation requires an operation and positive PID");
                if (operation.operation() == MemoryExperimentOperation.Operation.ALLOCATE) {
                    if (operation.amount() == null || operation.amount() <= 0 || operation.amount() > workload.totalMemory())
                        throw new IllegalArgumentException("Allocation size must be between 1 and total memory");
                    // The same PID may be reused after a deallocation. Failed strategy allocations remain part of the measured run.
                    if (!allocated.add(operation.pid()))
                        throw new IllegalArgumentException("PID " + operation.pid() + " must be deallocated before another allocation request");
                    knownPids.add(operation.pid());
                } else {
                    if (operation.amount() != null) throw new IllegalArgumentException("Deallocation operations do not take an amount");
                    if (!knownPids.contains(operation.pid()))
                        throw new IllegalArgumentException("PID " + operation.pid() + " must have an earlier allocation request before deallocation");
                    allocated.remove(operation.pid());
                }
            }
        }
    }

    private void validateVariantIdentity(ExperimentVariantRequest variant, Set<String> ids) {
        if (variant == null || variant.variantId() == null || variant.variantId().isBlank()
                || variant.label() == null || variant.label().isBlank() || variant.label().trim().length() > 80)
            throw new IllegalArgumentException("Every variant requires an ID and a label of at most 80 characters");
        if (!ids.add(variant.variantId())) throw new IllegalArgumentException("Variant IDs must be unique");
    }

    private void validateAlgorithm(SchedulingAlgorithm algorithm, Integer quantum, boolean preemptive) {
        if (algorithm == SchedulingAlgorithm.ROUND_ROBIN) {
            if (quantum == null || quantum <= 0 || quantum > 100000)
                throw new IllegalArgumentException("Round Robin quantum must be between 1 and 100000");
        } else if (quantum != null && quantum != 0) {
            throw new IllegalArgumentException("Quantum is only supported for Round Robin");
        }
        if (algorithm != SchedulingAlgorithm.PRIORITY && preemptive)
            throw new IllegalArgumentException("Preemptive mode is only supported for Priority scheduling");
    }

    private void validateWorkload(WorkloadDefinition workload) {
        if (workload.processes() == null || workload.processes().isEmpty() || workload.processes().size() > 256)
            throw new IllegalArgumentException("Base workload must contain between 1 and 256 processes");
        if (workload.algorithm() == null) throw new IllegalArgumentException("Base workload has no scheduling algorithm");
        validateAlgorithm(workload.algorithm(), workload.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? workload.timeQuantum() : 0,
                workload.preemptivePriority());
    }

    private WorkloadDefinition immutableCopy(WorkloadDefinition source) {
        return new WorkloadDefinition(source.id(), source.name(), source.description(), source.createdAt(), source.updatedAt(),
                List.copyOf(source.processes()), source.algorithm(), source.timeQuantum(), source.preemptivePriority(),
                source.totalMemory(), source.memoryAllocationStrategy(), source.speed());
    }

    private ExperimentVariantResult runSchedulingBaseline(WorkloadDefinition workload) {
        ComparisonAlgorithmResult result = schedule(workload.processes(), workload.algorithm(),
                workload.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? workload.timeQuantum() : 0,
                workload.preemptivePriority(), "baseline", "Baseline");
        return new ExperimentVariantResult("baseline", "Baseline", new ExperimentConfiguration(workload.algorithm(),
                workload.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? workload.timeQuantum() : null,
                workload.preemptivePriority(), null, null), List.of("Saved workload baseline configuration"), result, null);
    }

    private ExperimentVariantResult runSchedulingVariant(WorkloadDefinition workload, ExperimentVariantRequest variant) {
        Map<Integer, com.kernelx.dto.ProcessParameterChange> changes = new HashMap<>();
        if (variant.processChanges() != null) variant.processChanges().forEach(change -> changes.put(change.pid(), change));
        List<WorkloadProcessDefinition> processes = workload.processes().stream().map(process -> {
            var change = changes.get(process.pid());
            return new WorkloadProcessDefinition(process.pid(), process.name(), process.priority(),
                    change != null && change.arrivalTime() != null ? change.arrivalTime() : process.arrivalTime(),
                    change != null && change.burstTime() != null ? change.burstTime() : process.burstTime(),
                    process.memoryRequirement(), process.parentPid());
        }).map(process -> {
            var change = changes.get(process.pid());
            return change != null && change.priority() != null ? new WorkloadProcessDefinition(process.pid(), process.name(),
                    change.priority(), process.arrivalTime(), process.burstTime(), process.memoryRequirement(), process.parentPid()) : process;
        }).toList();
        boolean preemptive = Boolean.TRUE.equals(variant.preemptivePriority());
        int quantum = variant.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? variant.timeQuantum() : 0;
        ComparisonAlgorithmResult result = schedule(processes, variant.algorithm(), quantum, preemptive, variant.variantId(), variant.label());
        List<String> descriptions = new ArrayList<>();
        if (variant.algorithm() != workload.algorithm()) descriptions.add("Algorithm: " + workload.algorithm() + " → " + variant.algorithm());
        if (variant.algorithm() == SchedulingAlgorithm.ROUND_ROBIN && workload.timeQuantum() != quantum)
            descriptions.add("Round Robin quantum: " + workload.timeQuantum() + " → " + quantum);
        if (variant.algorithm() == SchedulingAlgorithm.PRIORITY && workload.preemptivePriority() != preemptive)
            descriptions.add("Priority preemption: " + workload.preemptivePriority() + " → " + preemptive);
        for (var entry : changes.entrySet()) {
            WorkloadProcessDefinition original = workload.processes().stream().filter(item -> item.pid() == entry.getKey()).findFirst().orElseThrow();
            var change = entry.getValue();
            if (change.arrivalTime() != null && change.arrivalTime() != original.arrivalTime()) descriptions.add("PID " + original.pid() + " arrival: " + original.arrivalTime() + " → " + change.arrivalTime());
            if (change.burstTime() != null && change.burstTime() != original.burstTime()) descriptions.add("PID " + original.pid() + " burst: " + original.burstTime() + " → " + change.burstTime());
            if (change.priority() != null && change.priority() != original.priority()) descriptions.add("PID " + original.pid() + " priority: " + original.priority() + " → " + change.priority());
        }
        if (descriptions.isEmpty()) descriptions.add("No scheduling parameters changed; algorithm configuration differs only by label");
        return new ExperimentVariantResult(variant.variantId(), variant.label(), new ExperimentConfiguration(variant.algorithm(),
                variant.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? quantum : null, preemptive, null, null), descriptions, result, null);
    }

    private ComparisonAlgorithmResult schedule(List<WorkloadProcessDefinition> definitions, SchedulingAlgorithm algorithm,
                                               int quantum, boolean preemptive, String id, String label) {
        try {
            List<SchedulingProcess> input = definitions.stream().map(p -> new SchedulingProcess(p.pid(), p.name(), p.priority(), p.arrivalTime(), p.burstTime())).toList();
            SchedulingResult result = schedulerFactory.get().schedule(input, algorithm, quantum, preemptive);
            int total = result.totalTime();
            if (total <= 0) throw new IllegalStateException("Scheduler returned a non-positive total time");
            int busy = result.gantt().stream().filter(segment -> !segment.idle()).mapToInt(GanttSegment::duration).sum();
            return new ComparisonAlgorithmResult(id, label, algorithm, preemptive, quantum, result.gantt(), result.processes(),
                    result.averageWaitingTime(), result.averageTurnaroundTime(), result.averageResponseTime(), total,
                    100.0 * busy / total, (double) result.processes().size() / total);
        } catch (RuntimeException failure) {
            throw new ComparisonExecutionException("Experiment variant " + label + " failed. No report was saved.", failure);
        }
    }

    private ExperimentVariantResult runMemory(int totalMemory, List<MemoryExperimentOperation> requests, String id,
                                              String label, MemoryAllocationStrategy strategy, List<String> changes) {
        try {
            MemoryManager manager = new MemoryManager(totalMemory, new EventManager());
            int successes = 0, failures = 0, frees = 0;
            List<MemoryOperationResult> operations = new ArrayList<>(requests.size());
            for (int index = 0; index < requests.size(); index++) {
                MemoryExperimentOperation operation = requests.get(index);
                if (operation.operation() == MemoryExperimentOperation.Operation.ALLOCATE) {
                    boolean succeeded = manager.allocate(operation.pid(), operation.amount(), strategy);
                    if (succeeded) successes++; else failures++;
                    operations.add(new MemoryOperationResult(index, operation.operation(), operation.pid(), operation.amount(), succeeded,
                            succeeded ? "Allocated" : "No contiguous free block large enough"));
                } else {
                    boolean succeeded = manager.deallocate(operation.pid());
                    if (succeeded) frees++;
                    operations.add(new MemoryOperationResult(index, operation.operation(), operation.pid(), null, succeeded,
                            succeeded ? "Deallocated" : "PID had no allocation under this strategy"));
                }
            }
            MemorySnapshot snapshot = manager.snapshot();
            int largestFree = snapshot.blocks().stream().filter(MemoryBlockView::free).mapToInt(MemoryBlockView::size).max().orElse(0);
            double fragmentation = snapshot.freeMemory() == 0 ? 0.0
                    : 100.0 * (1.0 - (double) largestFree / snapshot.freeMemory());
            return new ExperimentVariantResult(id, label,
                    new ExperimentConfiguration(null, null, false, strategy, totalMemory), changes, null,
                    new MemoryVariantResult(successes, failures, frees, totalMemory, snapshot.allocatedMemory(), snapshot.freeMemory(),
                            largestFree, fragmentation, snapshot.blocks(), operations));
        } catch (RuntimeException failure) {
            throw new ComparisonExecutionException("Memory experiment variant " + label + " failed. No report was saved.", failure);
        }
    }

    private List<ExperimentMetricComparison> metricDeltas(ExperimentType type, ExperimentVariantResult baseline,
                                                           List<ExperimentVariantResult> variants) {
        List<ExperimentMetricComparison> rows = new ArrayList<>();
        for (ExperimentVariantResult variant : variants) {
            Map<String, Double> base = metricValues(type, baseline);
            Map<String, Double> values = metricValues(type, variant);
            values.forEach((metric, value) -> {
                double before = base.get(metric);
                double difference = value - before;
                Double percentage = before == 0.0 ? null : difference / Math.abs(before) * 100.0;
                rows.add(new ExperimentMetricComparison(variant.variantId(), variant.label(), metric, before, value,
                        difference, Math.abs(difference), percentage));
            });
        }
        return List.copyOf(rows);
    }

    private Map<String, Double> metricValues(ExperimentType type, ExperimentVariantResult result) {
        Map<String, Double> values = new java.util.LinkedHashMap<>();
        if (type == ExperimentType.SCHEDULING) {
            var r = result.schedulingResult();
            values.put("averageWaitingTime", r.averageWaitingTime()); values.put("averageTurnaroundTime", r.averageTurnaroundTime());
            values.put("averageResponseTime", r.averageResponseTime()); values.put("cpuUtilization", r.cpuUtilization()); values.put("throughput", r.throughput());
        } else {
            var r = result.memoryResult();
            values.put("successfulAllocations", (double) r.successfulAllocations()); values.put("failedAllocations", (double) r.failedAllocations());
            values.put("totalFreeMemory", (double) r.freeMemory()); values.put("largestFreeBlock", (double) r.largestFreeBlock());
            values.put("allocatedMemory", (double) r.allocatedMemory()); values.put("externalFragmentation", r.externalFragmentation());
        }
        return values;
    }

    private List<ProcessMetricDelta> processDeltas(ExperimentVariantResult baseline, List<ExperimentVariantResult> variants) {
        Map<Integer, ProcessMetrics> base = new HashMap<>();
        baseline.schedulingResult().processes().forEach(metric -> base.put(metric.pid(), metric));
        List<ProcessMetricDelta> deltas = new ArrayList<>();
        for (ExperimentVariantResult variant : variants) {
            for (ProcessMetrics actual : variant.schedulingResult().processes()) {
                ProcessMetrics original = base.get(actual.pid());
                if (original != null) deltas.add(new ProcessMetricDelta(variant.variantId(), actual.pid(), actual.name(),
                        original.waitingTime(), actual.waitingTime(), actual.waitingTime() - original.waitingTime(),
                        original.turnaroundTime(), actual.turnaroundTime(), actual.turnaroundTime() - original.turnaroundTime(),
                        original.responseTime(), actual.responseTime(), actual.responseTime() - original.responseTime()));
            }
        }
        return List.copyOf(deltas);
    }

    private List<ComparisonMetricWinner> winners(ExperimentType type, ExperimentVariantResult baseline,
                                                  List<ExperimentVariantResult> variants) {
        List<ExperimentVariantResult> all = new ArrayList<>(); all.add(baseline); all.addAll(variants);
        Map<String, Double> initial = metricValues(type, baseline);
        List<ComparisonMetricWinner> results = new ArrayList<>();
        for (String metric : initial.keySet()) {
            boolean maximize = metric.equals("cpuUtilization") || metric.equals("throughput")
                    || metric.equals("successfulAllocations") || metric.equals("totalFreeMemory") || metric.equals("largestFreeBlock")
                    || metric.equals("allocatedMemory");
            double best = metricValues(type, all.getFirst()).get(metric);
            for (int i = 1; i < all.size(); i++) {
                double value = metricValues(type, all.get(i)).get(metric);
                if (maximize ? value > best : value < best) best = value;
            }
            final double bestValue = best;
            List<ExperimentVariantResult> tied = all.stream().filter(item -> Double.compare(metricValues(type, item).get(metric), bestValue) == 0).toList();
            results.add(new ComparisonMetricWinner(metric, maximize ? "MAXIMIZE" : "MINIMIZE", best,
                    tied.stream().map(ExperimentVariantResult::variantId).toList(), tied.stream().map(ExperimentVariantResult::label).toList()));
        }
        return List.copyOf(results);
    }

    private String schedulingSignature(WorkloadDefinition workload, ExperimentVariantRequest variant) {
        SchedulingAlgorithm algorithm = variant == null ? workload.algorithm() : variant.algorithm();
        int quantum = variant == null ? workload.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? workload.timeQuantum() : 0
                : algorithm == SchedulingAlgorithm.ROUND_ROBIN ? variant.timeQuantum() : 0;
        boolean preemptive = variant == null ? workload.preemptivePriority() : Boolean.TRUE.equals(variant.preemptivePriority());
        Map<Integer, com.kernelx.dto.ProcessParameterChange> changes = new HashMap<>();
        if (variant != null && variant.processChanges() != null) variant.processChanges().forEach(change -> changes.put(change.pid(), change));
        String processSignature = workload.processes().stream().sorted(Comparator.comparingInt(WorkloadProcessDefinition::pid)).map(process -> {
            var change = changes.get(process.pid());
            int arrival = change != null && change.arrivalTime() != null ? change.arrivalTime() : process.arrivalTime();
            int burst = change != null && change.burstTime() != null ? change.burstTime() : process.burstTime();
            int priority = change != null && change.priority() != null ? change.priority() : process.priority();
            return process.pid() + ":" + arrival + ":" + burst + ":" + priority;
        }).collect(java.util.stream.Collectors.joining("|"));
        return algorithm + ":" + quantum + ":" + preemptive + ":" + processSignature;
    }
}
