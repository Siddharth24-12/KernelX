package com.kernelx.service;

import com.kernelx.dsa.CustomHashTable;
import com.kernelx.dsa.ProcessLinkedList;
import com.kernelx.dsa.ProcessTree;
import com.kernelx.model.ProcessControlBlock;
import com.kernelx.model.ProcessState;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SystemEventType;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Process registry backed by the Phase 1 custom PCB list, PID hash table, and process tree. */
public final class ProcessManager {
    private final ProcessLinkedList processes = new ProcessLinkedList();
    private final CustomHashTable<Integer, ProcessControlBlock> byPid = new CustomHashTable<>();
    private final ProcessTree hierarchy = new ProcessTree();
    private final EventManager events;
    private MemoryManager memoryManager;

    public ProcessManager(EventManager events) { this.events = Objects.requireNonNull(events, "events"); }

    synchronized void attachMemoryManager(MemoryManager memoryManager) {
        this.memoryManager = Objects.requireNonNull(memoryManager, "memoryManager");
    }

    public synchronized ProcessControlBlock createProcess(int pid, String name, int priority, int arrivalTime,
                                                          int burstTime, int memoryRequirement, int parentPid) {
        if (byPid.get(pid) != null) throw new IllegalArgumentException("Duplicate PID: " + pid);
        ProcessControlBlock process = new ProcessControlBlock(pid, name, priority, arrivalTime, burstTime,
                memoryRequirement, parentPid);
        if (parentPid != -1 && byPid.get(parentPid) == null) {
            throw new IllegalArgumentException("Parent process not found: " + parentPid);
        }
        hierarchy.add(process);
        processes.insert(process);
        byPid.put(pid, process);
        events.record(pid, SystemEventType.PROCESS_CREATED, "Process " + name + " created");
        return process;
    }

    /** Terminates the process and any descendants, keeping all three custom indexes consistent. */
    public synchronized boolean terminateProcess(int pid) {
        ProcessControlBlock target = byPid.get(pid);
        if (target == null || target.getState() == ProcessState.TERMINATED) return false;
        List<Integer> removedPids = new ArrayList<>();
        processes.traverse(process -> {
            if (process.getPid() == pid || isDescendantOf(process, pid)) removedPids.add(process.getPid());
        });
        for (int childPid : removedPids) {
            ProcessControlBlock process = byPid.get(childPid);
            if (process != null) {
                ProcessState previous = process.getState();
                process.setState(ProcessState.TERMINATED);
                events.record(childPid, SystemEventType.STATE_CHANGED, previous + " -> TERMINATED: Process terminated");
                events.record(childPid, SystemEventType.PROCESS_TERMINATED,
                        childPid == pid ? "Process terminated" : "Descendant process terminated with parent " + pid);
                if (memoryManager != null) memoryManager.deallocate(childPid);
                byPid.remove(childPid);
                processes.remove(childPid);
            }
        }
        hierarchy.remove(pid);
        return true;
    }

    public synchronized boolean crashProcess(int pid, String reason) {
        ProcessControlBlock process = byPid.get(pid);
        if (process == null || process.getState() == ProcessState.TERMINATED) return false;
        events.record(pid, SystemEventType.PROCESS_CRASHED, "Process crashed: " + Objects.requireNonNullElse(reason, "unspecified"));
        return terminateProcess(pid);
    }

    public synchronized boolean pauseProcess(int pid) {
        ProcessControlBlock process = byPid.get(pid);
        if (process == null || (process.getState() != ProcessState.NEW && process.getState() != ProcessState.READY
                && process.getState() != ProcessState.RUNNING && process.getState() != ProcessState.WAITING)) return false;
        transition(process, ProcessState.PAUSED, "Process paused");
        return true;
    }

    public synchronized boolean resumeProcess(int pid) {
        ProcessControlBlock process = byPid.get(pid);
        if (process == null || process.getState() != ProcessState.PAUSED) return false;
        transition(process, ProcessState.READY, "Process resumed and placed in ready state");
        return true;
    }

    public synchronized boolean changePriority(int pid, int priority) {
        ProcessControlBlock process = byPid.get(pid);
        if (process == null || process.getState() == ProcessState.TERMINATED) return false;
        ProcessControlBlock.validatePriority(priority);
        int previous = process.getPriority();
        process.setPriority(priority);
        events.record(pid, SystemEventType.PRIORITY_CHANGED, "Priority changed from " + previous + " to " + priority);
        return true;
    }

    public synchronized ProcessControlBlock getProcess(int pid) { return byPid.get(pid); }

    public synchronized List<ProcessControlBlock> listProcesses() {
        List<ProcessControlBlock> result = new ArrayList<>(processes.size());
        processes.traverse(result::add);
        return List.copyOf(result);
    }

    public synchronized List<ProcessControlBlock> hierarchyPreOrder() {
        List<ProcessControlBlock> result = new ArrayList<>(hierarchy.size());
        hierarchy.traversePreOrder(result::add);
        return List.copyOf(result);
    }

    public synchronized List<SchedulingProcess> schedulingInputs() {
        List<SchedulingProcess> result = new ArrayList<>();
        processes.traverse(process -> {
            if (process.getState() == ProcessState.NEW || process.getState() == ProcessState.READY) {
                result.add(SchedulingProcess.from(process));
            }
        });
        return List.copyOf(result);
    }

    public synchronized void makeReadyForSimulation() {
        processes.traverse(process -> {
            if (process.getState() == ProcessState.NEW) transition(process, ProcessState.READY, "Process added to ready set");
        });
    }

    public synchronized void incrementReadyWaitingTimes(int simulationTime) {
        processes.traverse(process -> {
            if (process.getArrivalTime() <= simulationTime) process.incrementWaitingTime();
        });
    }

    public synchronized void activateArrivals(int simulationTime) {
        processes.traverse(process -> {
            if (process.getState() == ProcessState.NEW && process.getArrivalTime() <= simulationTime) {
                transition(process, ProcessState.READY, "Process arrived and entered the ready set");
            }
        });
    }

    public synchronized void transitionProcess(int pid, ProcessState state, String description) {
        ProcessControlBlock process = byPid.get(pid);
        if (process == null) throw new IllegalArgumentException("Process not found: " + pid);
        transition(process, state, description);
    }

    public synchronized void markFirstStarted(int pid, int time) {
        ProcessControlBlock process = requireProcess(pid);
        process.markFirstStarted(time);
    }

    public synchronized void updateRemainingTime(int pid, int remainingTime) {
        requireProcess(pid).setRemainingTime(remainingTime);
    }

    public synchronized void completeProcessAt(int pid, int time) {
        ProcessControlBlock process = requireProcess(pid);
        ProcessState previous = process.getState();
        process.completeAt(time);
        events.record(pid, SystemEventType.STATE_CHANGED, previous + " -> TERMINATED: CPU burst completed");
        events.record(pid, SystemEventType.PROCESS_TERMINATED, "Process completed at simulation time " + time);
        // Completed processes remain in the list/hash/tree for metrics and history.
    }

    public synchronized void resetProcesses() {
        processes.traverse(ProcessControlBlock::resetForSimulation);
    }

    public synchronized void recordSchedulingDecision(int pid, String description) {
        events.record(pid, SystemEventType.SCHEDULING_DECISION, description);
    }

    public synchronized void setWaiting(int pid, String reason) {
        ProcessControlBlock process = requireProcess(pid);
        transition(process, ProcessState.WAITING, reason);
    }

    private void transition(ProcessControlBlock process, ProcessState next, String description) {
        ProcessState current = process.getState();
        if (!isAllowed(current, next)) throw new IllegalStateException("Invalid process state transition: " + current + " -> " + next);
        process.setState(next);
        events.record(process.getPid(), SystemEventType.STATE_CHANGED, current + " -> " + next + ": " + description);
    }

    private boolean isAllowed(ProcessState from, ProcessState to) {
        return switch (from) {
            case NEW -> to == ProcessState.READY || to == ProcessState.PAUSED || to == ProcessState.TERMINATED;
            case READY -> to == ProcessState.RUNNING || to == ProcessState.WAITING || to == ProcessState.PAUSED || to == ProcessState.TERMINATED;
            case RUNNING -> to == ProcessState.READY || to == ProcessState.WAITING || to == ProcessState.PAUSED || to == ProcessState.TERMINATED;
            case WAITING -> to == ProcessState.READY || to == ProcessState.PAUSED || to == ProcessState.TERMINATED;
            case PAUSED -> to == ProcessState.READY || to == ProcessState.TERMINATED;
            case TERMINATED -> false;
        };
    }

    private boolean isDescendantOf(ProcessControlBlock process, int ancestorPid) {
        int parentPid = process.getParentPid();
        while (parentPid != -1) {
            if (parentPid == ancestorPid) return true;
            ProcessControlBlock parent = byPid.get(parentPid);
            if (parent == null) return false;
            parentPid = parent.getParentPid();
        }
        return false;
    }

    private ProcessControlBlock requireProcess(int pid) {
        ProcessControlBlock process = byPid.get(pid);
        if (process == null) throw new IllegalArgumentException("Process not found: " + pid);
        return process;
    }
}
