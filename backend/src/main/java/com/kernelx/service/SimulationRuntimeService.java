package com.kernelx.service;

import com.kernelx.dto.CreateProcessRequest;
import com.kernelx.dto.ProcessResponse;
import com.kernelx.dto.SimulationStartRequest;
import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;
import com.kernelx.model.SchedulingResult;
import com.kernelx.model.SimulationSnapshot;
import com.kernelx.model.SimulationStatus;
import com.kernelx.model.SystemEvent;
import java.util.List;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Singleton session boundary. Synchronization serializes REST mutations and snapshots. */
@Service
public class SimulationRuntimeService {
    private final EventManager events;
    private final ProcessManager processes;
    private final SchedulingService scheduler;
    private MemoryManager memory;
    private SimulationEngine engine;
    private MemoryAllocationStrategy defaultMemoryStrategy = MemoryAllocationStrategy.FIRST_FIT;
    private int totalMemory;

    public SimulationRuntimeService(EventManager events, ProcessManager processes, SchedulingService scheduler,
                                    @Value("${kernelx.simulation.total-memory:1024}") int totalMemory) {
        if (totalMemory <= 0) throw new IllegalArgumentException("Default total memory must be positive");
        this.events = events;
        this.processes = processes;
        this.scheduler = scheduler;
        this.totalMemory = totalMemory;
        this.memory = new MemoryManager(totalMemory, events);
        this.engine = new SimulationEngine(processes, memory, events, scheduler);
    }

    public synchronized ProcessResponse createProcess(CreateProcessRequest request) {
        ensureProcessMutationAllowed();
        ProcessControlBlock process = processes.createProcess(request.pid(), request.name(), request.priority(),
                request.arrivalTime(), request.burstTime(), request.memoryRequirement(), request.parentPid());
        return ProcessResponse.from(process);
    }

    public synchronized List<ProcessResponse> listProcesses() {
        return processes.listProcesses().stream().map(ProcessResponse::from).toList();
    }

    public synchronized ProcessResponse getProcess(int pid) { return ProcessResponse.from(requireProcess(pid)); }

    public synchronized void deleteProcess(int pid) {
        ensureProcessMutationAllowed();
        if (!processes.terminateProcess(pid)) throw new ResourceNotFoundException("Process " + pid + " was not found");
    }

    public synchronized ProcessResponse changePriority(int pid, int priority) {
        ensureProcessMutationAllowed();
        requireProcess(pid);
        if (!processes.changePriority(pid, priority)) throw new ConflictException("Process priority cannot be changed from its current state");
        return ProcessResponse.from(requireProcess(pid));
    }

    public synchronized ProcessResponse pauseProcess(int pid) {
        ensureProcessMutationAllowed();
        requireProcess(pid);
        if (!processes.pauseProcess(pid)) throw new ConflictException("Process cannot be paused from its current state");
        return ProcessResponse.from(requireProcess(pid));
    }

    public synchronized ProcessResponse resumeProcess(int pid) {
        ensureProcessMutationAllowed();
        requireProcess(pid);
        if (!processes.resumeProcess(pid)) throw new ConflictException("Process is not paused");
        return ProcessResponse.from(requireProcess(pid));
    }

    public synchronized SimulationSnapshot start(SimulationStartRequest request) {
        if (engine.state().status() != SimulationStatus.READY) {
            throw new ConflictException("Reset the current simulation before starting a new run");
        }
        if (request.totalMemory() != null && request.totalMemory() != totalMemory) {
            if (memory.snapshot().allocatedMemory() != 0) {
                throw new ConflictException("Cannot change total memory while blocks are allocated");
            }
            totalMemory = request.totalMemory();
            memory = new MemoryManager(totalMemory, events);
            engine = new SimulationEngine(processes, memory, events, scheduler);
        }
        defaultMemoryStrategy = request.memoryAllocationStrategy();
        engine.setSpeed(request.speed() == null ? 1.0 : request.speed());
        return engine.start(request.toSimulationConfiguration());
    }

    public synchronized SimulationSnapshot pauseSimulation() {
        if (engine.state().status() != SimulationStatus.RUNNING) throw new ConflictException("Simulation is not running");
        return engine.pause();
    }

    public synchronized SimulationSnapshot resumeSimulation() {
        if (engine.state().status() != SimulationStatus.PAUSED) throw new ConflictException("Simulation is not paused");
        return engine.resume();
    }

    public synchronized SimulationSnapshot step(int ticks) {
        if (engine.state().status() != SimulationStatus.RUNNING) throw new ConflictException("Simulation must be running before stepping");
        return engine.tick(ticks);
    }

    public synchronized SimulationSnapshot reset() { return engine.reset(); }
    public synchronized SimulationSnapshot state() { return engine.state(); }

    public synchronized SchedulingResult scheduling() {
        SchedulingResult result = engine.schedulingResult();
        if (result == null) throw new ConflictException("Start a simulation before requesting scheduling output");
        return result;
    }

    public synchronized MemorySnapshot memory() { return engine.memorySnapshot(); }

    public synchronized MemorySnapshot allocateMemory(int pid, MemoryAllocationStrategy strategy) {
        ensureMemoryMutationAllowed();
        ProcessControlBlock process = requireProcess(pid);
        if (process.getState() == ProcessState.TERMINATED) {
            throw new ConflictException("Cannot allocate memory to a terminated process");
        }
        boolean allocated = engine.allocateProcessMemory(pid, strategy == null ? defaultMemoryStrategy : strategy);
        if (!allocated) throw new ConflictException("No contiguous memory block can satisfy this process");
        return engine.memorySnapshot();
    }

    public synchronized MemorySnapshot deallocateMemory(int pid) {
        ensureMemoryMutationAllowed();
        if (!engine.deallocateProcessMemory(pid)) throw new ResourceNotFoundException("No memory allocation found for PID " + pid);
        return engine.memorySnapshot();
    }

    public synchronized List<SystemEvent> events() { return events.snapshot(); }
    public synchronized List<ProcessControlBlock> processSnapshots() { return processes.listProcesses(); }
    public synchronized SimulationStatus status() { return engine.state().status(); }
    public synchronized int totalMemory() { return totalMemory; }
    public synchronized MemoryAllocationStrategy defaultMemoryStrategy() { return defaultMemoryStrategy; }

    private ProcessControlBlock requireProcess(int pid) {
        ProcessControlBlock process = processes.getProcess(pid);
        if (process == null) throw new ResourceNotFoundException("Process " + pid + " was not found");
        return process;
    }

    private void ensureProcessMutationAllowed() {
        SimulationStatus status = engine.state().status();
        if (status == SimulationStatus.RUNNING || status == SimulationStatus.PAUSED) {
            throw new ConflictException("Process changes are locked while a simulation is active; reset first");
        }
    }

    private void ensureMemoryMutationAllowed() {
        SimulationStatus status = engine.state().status();
        if (status == SimulationStatus.RUNNING || status == SimulationStatus.PAUSED) {
            throw new ConflictException("Memory changes are locked while a simulation is active");
        }
    }
}
