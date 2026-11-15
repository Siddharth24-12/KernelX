package com.kernelx.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.CreateProcessRequest;
import com.kernelx.dto.SimulationStartRequest;
import com.kernelx.dto.WorkloadDefinition;
import com.kernelx.dto.WorkloadExecutionResponse;
import com.kernelx.dto.WorkloadProcessDefinition;
import com.kernelx.dto.WorkloadRequest;
import com.kernelx.dto.WorkloadValidationResponse;
import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.persistence.JsonFileRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public final class WorkloadService {
    private final JsonFileRepository<WorkloadDefinition> repository;
    private final SimulationRuntimeService runtime;

    public WorkloadService(ObjectMapper mapper, @Value("${kernelx.data-directory:data}") String dataDirectory,
                           SimulationRuntimeService runtime) {
        repository = new JsonFileRepository<>(Path.of(dataDirectory).resolve("workloads.json"), WorkloadDefinition.class, mapper);
        this.runtime = runtime;
    }

    public synchronized List<WorkloadDefinition> findAll() {
        List<WorkloadDefinition> all = new ArrayList<>(templates());
        all.addAll(repository.findAll());
        return List.copyOf(all);
    }

    public synchronized List<WorkloadDefinition> templates() {
        return List.of(
                template("short-jobs", "Short Jobs", "A compact set of short CPU bursts.", SchedulingAlgorithm.SJF, 0,
                        process(61001, "compile", 4, 0, 3, 96), process(61002, "index", 5, 0, 2, 64), process(61003, "lint", 3, 1, 4, 80)),
                template("mixed", "Mixed", "A balanced mix of arrivals, priorities and burst lengths.", SchedulingAlgorithm.FCFS, 0,
                        process(61101, "editor", 5, 0, 5, 128), process(61102, "worker", 7, 2, 3, 192), process(61103, "logger", 2, 1, 2, 64)),
                template("cpu-intensive", "CPU Intensive", "Long running jobs that make scheduling choices visible.", SchedulingAlgorithm.ROUND_ROBIN, 3,
                        process(61201, "render", 5, 0, 12, 256), process(61202, "build", 6, 0, 9, 192), process(61203, "analysis", 4, 1, 7, 160)),
                template("arrival-burst", "Arrival Burst", "Several jobs arrive together after an initial idle interval.", SchedulingAlgorithm.FCFS, 0,
                        process(61301, "listener", 3, 4, 3, 64), process(61302, "parser", 5, 4, 5, 96), process(61303, "writer", 4, 5, 2, 80)),
                template("priority-conflict", "Priority Conflict", "Contrasting priorities and arrival times.", SchedulingAlgorithm.PRIORITY, 0,
                        process(61401, "background", 1, 0, 7, 128), process(61402, "interactive", 10, 2, 3, 96), process(61403, "maintenance", 3, 1, 4, 80)),
                template("idle-cpu", "Idle CPU", "A workload whose first job arrives after an idle window.", SchedulingAlgorithm.SJF, 0,
                        process(61501, "deferred-job", 5, 6, 3, 64), process(61502, "follow-up", 4, 10, 2, 64)));
    }

    public synchronized WorkloadDefinition create(WorkloadRequest request) {
        WorkloadValidationResponse validation = validate(request, false);
        if (!validation.valid()) throw new IllegalArgumentException(String.join("; ", validation.errors()));
        Instant now = Instant.now();
        WorkloadDefinition workload = fromRequest(UUID.randomUUID().toString(), now, now, request);
        repository.append(workload);
        return workload;
    }

    public synchronized WorkloadDefinition update(String id, WorkloadRequest request) {
        WorkloadDefinition existing = findSaved(id);
        WorkloadValidationResponse validation = validate(request, false);
        if (!validation.valid()) throw new IllegalArgumentException(String.join("; ", validation.errors()));
        WorkloadDefinition updated = fromRequest(id, existing.createdAt(), Instant.now(), request);
        List<WorkloadDefinition> rows = new ArrayList<>(repository.findAll());
        rows.replaceAll(row -> row.id().equals(id) ? updated : row);
        repository.saveAll(rows);
        return updated;
    }

    public synchronized WorkloadDefinition findById(String id) {
        if (id.startsWith("builtin-")) return templates().stream().filter(item -> item.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Workload template " + id + " was not found"));
        return findSaved(id);
    }

    public synchronized void delete(String id) {
        if (id.startsWith("builtin-")) throw new ConflictException("Built-in workload templates cannot be deleted");
        if (!repository.removeIf(item -> item.id().equals(id))) throw new ResourceNotFoundException("Workload " + id + " was not found");
    }

    public synchronized WorkloadValidationResponse validate(WorkloadRequest request) {
        return validate(request, true);
    }

    private WorkloadValidationResponse validate(WorkloadRequest request, boolean includeRuntimeConstraints) {
        List<String> errors = new ArrayList<>();
        if (request == null) return new WorkloadValidationResponse(false, List.of("Request body is required"), List.of());
        List<WorkloadProcessDefinition> definitions = request.processes() == null ? List.of() : request.processes();
        if (definitions.isEmpty()) errors.add("Add at least one process");
        if (request.algorithm() == SchedulingAlgorithm.ROUND_ROBIN && request.timeQuantum() <= 0) {
            errors.add("Round Robin requires a positive time quantum");
        }
        Set<Integer> pids = new HashSet<>();
        Set<Integer> existingPids = new HashSet<>();
        runtime.listProcesses().forEach(process -> existingPids.add(process.pid()));
        if (includeRuntimeConstraints && !existingPids.isEmpty()) {
            errors.add("Terminate existing processes before running a workload");
        }
        if (includeRuntimeConstraints && runtime.status() != com.kernelx.model.SimulationStatus.READY) {
            errors.add("Reset the simulation before running a workload");
        }
        for (WorkloadProcessDefinition process : definitions) {
            if (!pids.add(process.pid())) errors.add("PID " + process.pid() + " appears more than once");
            if (includeRuntimeConstraints && existingPids.contains(process.pid())) errors.add("PID " + process.pid() + " is already in the simulator");
        }
        Map<Integer, WorkloadProcessDefinition> byPid = new HashMap<>();
        definitions.forEach(process -> byPid.putIfAbsent(process.pid(), process));
        for (WorkloadProcessDefinition process : definitions) {
            int parentPid = process.parentPid() == null ? -1 : process.parentPid();
            if (parentPid != -1 && !byPid.containsKey(parentPid) && !existingPids.contains(parentPid)) {
                errors.add("Parent PID " + parentPid + " for process " + process.pid() + " does not exist");
            }
            if (parentPid == process.pid()) errors.add("Process " + process.pid() + " cannot be its own parent");
        }
        for (WorkloadProcessDefinition process : definitions) {
            Set<Integer> visited = new HashSet<>();
            Integer current = process.pid();
            while (current != null && byPid.containsKey(current)) {
                if (!visited.add(current)) {
                    errors.add("Parent relationships contain a cycle involving PID " + current);
                    break;
                }
                int parent = byPid.get(current).parentPid() == null ? -1 : byPid.get(current).parentPid();
                current = parent == -1 || existingPids.contains(parent) ? null : parent;
            }
        }
        List<String> warnings = new ArrayList<>();
        if (!definitions.isEmpty() && definitions.stream().noneMatch(process -> process.arrivalTime() == 0)) {
            warnings.add("The CPU will remain idle until the first process arrival");
        }
        if (definitions.stream().mapToLong(WorkloadProcessDefinition::memoryRequirement).sum() > request.totalMemory()) {
            warnings.add("Combined requested memory exceeds total memory; processes are not automatically allocated memory");
        }
        return new WorkloadValidationResponse(errors.isEmpty(), List.copyOf(errors), List.copyOf(warnings));
    }

    public synchronized WorkloadExecutionResponse execute(String id) {
        WorkloadDefinition workload = findById(id);
        requireExecutable(workload);
        List<CreateProcessRequest> processRequests = processRequests(workload);
        SimulationStartRequest simulationRequest = new SimulationStartRequest(workload.algorithm(),
                workload.algorithm() == SchedulingAlgorithm.ROUND_ROBIN ? workload.timeQuantum() : null,
                workload.preemptivePriority(), workload.totalMemory(), workload.memoryAllocationStrategy(), workload.speed());
        List<com.kernelx.dto.ProcessResponse> created = runtime.executeWorkload(processRequests, simulationRequest);
        return new WorkloadExecutionResponse(id, created.stream().map(com.kernelx.dto.ProcessResponse::pid).toList(), runtime.state());
    }

    public synchronized com.kernelx.dto.WorkloadLoadResponse load(String id) {
        WorkloadDefinition workload = findById(id);
        requireExecutable(workload);
        List<com.kernelx.dto.ProcessResponse> processes = runtime.loadWorkload(processRequests(workload));
        return new com.kernelx.dto.WorkloadLoadResponse(id, processes);
    }

    private void requireExecutable(WorkloadDefinition workload) {
        WorkloadRequest request = new WorkloadRequest(workload.name(), workload.description(), workload.processes(),
                workload.algorithm(), workload.timeQuantum(), workload.preemptivePriority(), workload.totalMemory(),
                workload.memoryAllocationStrategy(), workload.speed());
        WorkloadValidationResponse validation = validate(request, true);
        if (!validation.valid()) throw new ConflictException(String.join("; ", validation.errors()));
    }

    private List<CreateProcessRequest> processRequests(WorkloadDefinition workload) {
        return creationOrder(workload.processes()).stream().map(process -> new CreateProcessRequest(
                process.pid(), process.name(), process.priority(), process.arrivalTime(), process.burstTime(),
                process.memoryRequirement(), process.parentPid())).toList();
    }

    private List<WorkloadProcessDefinition> creationOrder(List<WorkloadProcessDefinition> processes) {
        List<WorkloadProcessDefinition> remaining = new ArrayList<>(processes);
        List<WorkloadProcessDefinition> ordered = new ArrayList<>();
        Set<Integer> added = new HashSet<>();
        Set<Integer> existing = new HashSet<>();
        runtime.listProcesses().forEach(process -> existing.add(process.pid()));
        while (!remaining.isEmpty()) {
            boolean progressed = false;
            for (var iterator = remaining.iterator(); iterator.hasNext();) {
                WorkloadProcessDefinition process = iterator.next();
                int parent = process.parentPid() == null ? -1 : process.parentPid();
                if (parent == -1 || existing.contains(parent) || added.contains(parent)) {
                    ordered.add(process); added.add(process.pid()); iterator.remove(); progressed = true;
                }
            }
            if (!progressed) throw new IllegalArgumentException("Parent relationships cannot be ordered");
        }
        return List.copyOf(ordered);
    }

    private WorkloadDefinition findSaved(String id) {
        return repository.findAll().stream().filter(item -> item.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Workload " + id + " was not found"));
    }

    private WorkloadDefinition fromRequest(String id, Instant created, Instant updated, WorkloadRequest request) {
        return new WorkloadDefinition(id, request.name().trim(), request.description() == null ? "" : request.description().trim(),
                created, updated, List.copyOf(request.processes()), request.algorithm(), request.timeQuantum(),
                request.preemptivePriority(), request.totalMemory(), request.memoryAllocationStrategy(), request.speed());
    }

    private WorkloadDefinition template(String id, String name, String description, SchedulingAlgorithm algorithm,
                                        int quantum, WorkloadProcessDefinition... processes) {
        return new WorkloadDefinition("builtin-" + id, name, description, null, null, List.of(processes), algorithm,
                quantum, false, 1024, MemoryAllocationStrategy.FIRST_FIT, 1.0);
    }

    private WorkloadProcessDefinition process(int pid, String name, int priority, int arrival, int burst, int memory) {
        return new WorkloadProcessDefinition(pid, name, priority, arrival, burst, memory, -1);
    }
}
