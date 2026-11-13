package com.kernelx.model;

import java.util.Objects;

/** Mutable process metadata used by the in-memory DSA structures. */
public final class ProcessControlBlock {
    public static final int MIN_PRIORITY = 0;
    public static final int MAX_PRIORITY = 10;

    private final int pid;
    private final String name;
    private int priority;
    private final int arrivalTime;
    private final int burstTime;
    private int remainingTime;
    private final int memoryRequirement;
    private ProcessState state;
    private final int parentPid;
    private int completionTime = -1;
    private int waitingTime;
    private int turnaroundTime = -1;
    private int responseTime = -1;

    public ProcessControlBlock(int pid, String name, int priority, int arrivalTime, int burstTime,
                               int memoryRequirement, int parentPid) {
        if (pid <= 0) throw new IllegalArgumentException("PID must be positive");
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Process name must not be blank");
        validatePriority(priority);
        if (arrivalTime < 0) throw new IllegalArgumentException("Arrival time must not be negative");
        if (burstTime <= 0) throw new IllegalArgumentException("Burst time must be positive");
        if (memoryRequirement <= 0) throw new IllegalArgumentException("Memory requirement must be positive");
        if (parentPid == pid || parentPid < -1) throw new IllegalArgumentException("Parent PID must be -1 or a different positive PID");
        this.pid = pid;
        this.name = name;
        this.priority = priority;
        this.arrivalTime = arrivalTime;
        this.burstTime = burstTime;
        this.remainingTime = burstTime;
        this.memoryRequirement = memoryRequirement;
        this.state = ProcessState.NEW;
        this.parentPid = parentPid;
    }

    public static void validatePriority(int priority) {
        if (priority < MIN_PRIORITY || priority > MAX_PRIORITY) {
            throw new IllegalArgumentException("Priority must be between 0 and 10");
        }
    }

    public int getPid() { return pid; }
    public String getName() { return name; }
    public int getPriority() { return priority; }
    public int getArrivalTime() { return arrivalTime; }
    public int getBurstTime() { return burstTime; }
    public int getRemainingTime() { return remainingTime; }
    public int getMemoryRequirement() { return memoryRequirement; }
    public ProcessState getState() { return state; }
    public int getParentPid() { return parentPid; }
    public int getCompletionTime() { return completionTime; }
    public int getWaitingTime() { return waitingTime; }
    public int getTurnaroundTime() { return turnaroundTime; }
    public int getResponseTime() { return responseTime; }

    public void setPriority(int priority) {
        validatePriority(priority);
        this.priority = priority;
    }

    public void setRemainingTime(int remainingTime) {
        if (remainingTime < 0 || remainingTime > burstTime) throw new IllegalArgumentException("Remaining time must be between 0 and burst time");
        this.remainingTime = remainingTime;
    }

    public void setState(ProcessState state) { this.state = Objects.requireNonNull(state, "state"); }

    public void markFirstStarted(int time) {
        if (time < arrivalTime) throw new IllegalArgumentException("Start time cannot precede arrival");
        if (responseTime < 0) responseTime = time - arrivalTime;
    }

    public void incrementWaitingTime() {
        if (state == ProcessState.READY) waitingTime++;
    }

    public void completeAt(int time) {
        if (time < arrivalTime) throw new IllegalArgumentException("Completion time cannot precede arrival");
        completionTime = time;
        turnaroundTime = time - arrivalTime;
        waitingTime = Math.max(waitingTime, turnaroundTime - burstTime);
        remainingTime = 0;
        state = ProcessState.TERMINATED;
    }

    public void resetForSimulation() {
        remainingTime = burstTime;
        completionTime = -1;
        waitingTime = 0;
        turnaroundTime = -1;
        responseTime = -1;
        state = ProcessState.NEW;
    }

    @Override
    public String toString() {
        return "ProcessControlBlock{" + "pid=" + pid + ", name='" + name + '\'' + ", priority=" + priority
                + ", state=" + state + ", remainingTime=" + remainingTime + '}';
    }
}
