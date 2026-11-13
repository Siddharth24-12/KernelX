package com.kernelx.service;

import com.kernelx.model.GanttSegment;
import com.kernelx.model.MemoryAllocationStrategy;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SchedulingResult;
import com.kernelx.model.SimulationConfiguration;
import com.kernelx.model.SimulationSnapshot;
import com.kernelx.model.SimulationStatus;
import com.kernelx.model.SystemEvent;
import com.kernelx.model.SystemEventType;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Tick-driven simulation façade. It advances a deterministic scheduling plan without sleeping or measuring host CPU. */
public final class SimulationEngine {
    private final ProcessManager processes;
    private final MemoryManager memory;
    private final EventManager events;
    private final SchedulingService scheduler;

    private SimulationStatus status = SimulationStatus.READY;
    private SimulationConfiguration configuration = SimulationConfiguration.fcfs();
    private SchedulingResult plan;
    private int currentTime;
    private int segmentIndex;
    private Integer runningPid;
    private double speed = 1.0;

    public SimulationEngine(ProcessManager processes, MemoryManager memory, EventManager events,
                            SchedulingService scheduler) {
        this.processes = Objects.requireNonNull(processes, "processes");
        this.memory = Objects.requireNonNull(memory, "memory");
        this.events = Objects.requireNonNull(events, "events");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.processes.attachMemoryManager(memory);
    }

    /** Builds a schedule from NEW/READY processes and starts its deterministic tick timeline. */
    public synchronized SimulationSnapshot start(SimulationConfiguration configuration) {
        if (status == SimulationStatus.RUNNING || status == SimulationStatus.PAUSED) {
            throw new IllegalStateException("Reset the current simulation before starting another");
        }
        this.configuration = Objects.requireNonNull(configuration, "configuration");
        List<SchedulingProcess> input = processes.schedulingInputs();
        plan = scheduler.schedule(input, configuration.algorithm(), configuration.timeQuantum(),
                configuration.preemptivePriority());
        currentTime = 0;
        segmentIndex = 0;
        runningPid = null;
        events.setSimulationTime(0);
        events.record(null, SystemEventType.SIMULATION_STARTED,
                "Started " + configuration.algorithm() + " simulation for " + input.size() + " processes");
        status = plan.totalTime() == 0 ? SimulationStatus.COMPLETED : SimulationStatus.RUNNING;
        return snapshot();
    }

    public synchronized SimulationSnapshot pause() {
        if (status != SimulationStatus.RUNNING) return snapshot();
        if (runningPid != null) {
            ProcessControlBlock process = processes.getProcess(runningPid);
            if (process != null && process.getState() == ProcessState.RUNNING) {
                processes.transitionProcess(runningPid, ProcessState.READY, "Simulation paused");
            }
            runningPid = null;
        }
        status = SimulationStatus.PAUSED;
        events.setSimulationTime(currentTime);
        events.record(null, SystemEventType.SIMULATION_PAUSED, "Simulation paused at tick " + currentTime);
        return snapshot();
    }

    public synchronized SimulationSnapshot resume() {
        if (status != SimulationStatus.PAUSED) return snapshot();
        status = SimulationStatus.RUNNING;
        events.setSimulationTime(currentTime);
        events.record(null, SystemEventType.SIMULATION_RESUMED, "Simulation resumed at tick " + currentTime);
        return snapshot();
    }

    public synchronized SimulationSnapshot reset() {
        memory.reset();
        processes.resetProcesses();
        currentTime = 0;
        segmentIndex = 0;
        runningPid = null;
        plan = null;
        status = SimulationStatus.READY;
        events.setSimulationTime(0);
        events.record(null, SystemEventType.SIMULATION_RESET, "Simulation reset");
        return snapshot();
    }

    /** Executes exactly one unit of simulated CPU time. Returns a snapshot unchanged if not running. */
    public synchronized SimulationSnapshot tick() {
        if (status != SimulationStatus.RUNNING) return snapshot();
        if (currentTime >= plan.totalTime()) {
            status = SimulationStatus.COMPLETED;
            runningPid = null;
            return snapshot();
        }

        events.setSimulationTime(currentTime);
        processes.activateArrivals(currentTime);
        while (segmentIndex < plan.gantt().size() && plan.gantt().get(segmentIndex).endTime() <= currentTime) segmentIndex++;
        GanttSegment segment = plan.gantt().get(segmentIndex);

        if (segment.idle()) {
            leaveRunningProcess();
            if (currentTime == segment.startTime()) events.record(null, SystemEventType.CPU_IDLE,
                    "CPU idle from tick " + segment.startTime() + " to " + segment.endTime());
            processes.incrementReadyWaitingTimes(currentTime);
            currentTime++;
            events.setSimulationTime(currentTime);
            finishIfComplete();
            return snapshot();
        }

        if (!Objects.equals(runningPid, segment.pid())) {
            leaveRunningProcess();
            ProcessControlBlock next = processes.getProcess(segment.pid());
            if (next == null) throw new IllegalStateException("Scheduled process is not registered: " + segment.pid());
            if (next.getState() == ProcessState.NEW) {
                processes.transitionProcess(next.getPid(), ProcessState.READY, "Process arrived and entered the ready set");
            }
            if (next.getState() != ProcessState.READY) {
                throw new IllegalStateException("Scheduled process is not ready: PID " + next.getPid() + " is " + next.getState());
            }
            next.markFirstStarted(currentTime);
            processes.transitionProcess(next.getPid(), ProcessState.RUNNING, "Selected by " + configuration.algorithm());
            processes.recordSchedulingDecision(next.getPid(), "PID " + next.getPid() + " selected by " + configuration.algorithm());
            runningPid = next.getPid();
        }

        processes.incrementReadyWaitingTimes(currentTime);
        ProcessControlBlock running = processes.getProcess(runningPid);
        processes.updateRemainingTime(runningPid, running.getRemainingTime() - 1);
        currentTime++;
        events.setSimulationTime(currentTime);

        ProcessControlBlock updated = processes.getProcess(runningPid);
        if (updated.getRemainingTime() == 0) {
            processes.completeProcessAt(runningPid, currentTime);
            if (memory.isAllocated(runningPid)) memory.deallocate(runningPid);
            runningPid = null;
        } else if (currentTime == segment.endTime()) {
            leaveRunningProcess();
        }

        finishIfComplete();
        return snapshot();
    }

    public synchronized SimulationSnapshot tick(int count) {
        if (count <= 0) throw new IllegalArgumentException("Tick count must be positive");
        for (int i = 0; i < count && status == SimulationStatus.RUNNING; i++) tick();
        return snapshot();
    }

    /** Speed is presentation timing metadata only; it never changes deterministic tick results. */
    public synchronized void setSpeed(double speed) {
        if (!Double.isFinite(speed) || speed < 0.1 || speed > 10.0) {
            throw new IllegalArgumentException("Simulation speed must be between 0.1 and 10.0");
        }
        this.speed = speed;
    }

    public synchronized boolean allocateProcessMemory(int pid, MemoryAllocationStrategy strategy) {
        ProcessControlBlock process = processes.getProcess(pid);
        if (process == null) throw new IllegalArgumentException("Process not found: " + pid);
        return memory.allocate(pid, process.getMemoryRequirement(), strategy);
    }

    public synchronized boolean deallocateProcessMemory(int pid) { return memory.deallocate(pid); }
    public synchronized MemorySnapshot memorySnapshot() { return memory.snapshot(); }
    public synchronized List<SystemEvent> events() { return events.snapshot(); }
    public synchronized SchedulingResult schedulingResult() { return plan; }
    public synchronized List<ProcessControlBlock> processes() { return processes.listProcesses(); }
    public synchronized SimulationSnapshot state() { return snapshot(); }

    private void leaveRunningProcess() {
        if (runningPid == null) return;
        ProcessControlBlock previous = processes.getProcess(runningPid);
        if (previous != null && previous.getState() == ProcessState.RUNNING) {
            processes.transitionProcess(runningPid, ProcessState.READY, "CPU time slice ended");
        }
        runningPid = null;
    }

    private void finishIfComplete() {
        if (currentTime >= plan.totalTime()) {
            leaveRunningProcess();
            status = SimulationStatus.COMPLETED;
        }
    }

    private SimulationSnapshot snapshot() {
        List<Integer> ready = new ArrayList<>();
        List<Integer> waiting = new ArrayList<>();
        for (ProcessControlBlock process : processes.listProcesses()) {
            if (process.getState() == ProcessState.READY) ready.add(process.getPid());
            else if (process.getState() == ProcessState.WAITING || process.getState() == ProcessState.PAUSED) waiting.add(process.getPid());
        }
        List<GanttSegment> completed = new ArrayList<>();
        if (plan != null) {
            for (GanttSegment segment : plan.gantt()) {
                if (segment.endTime() <= currentTime) completed.add(segment);
                else break;
            }
        }
        return new SimulationSnapshot(status, configuration.algorithm(), currentTime,
                plan == null ? 0 : plan.totalTime(), speed, runningPid, ready, waiting, completed);
    }
}
