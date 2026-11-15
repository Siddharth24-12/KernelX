package com.kernelx.service;

import com.kernelx.dsa.CustomQueue;
import com.kernelx.dsa.MaxHeap;
import com.kernelx.dto.HeapEntrySnapshot;
import com.kernelx.dto.FpbLiveSnapshot;
import com.kernelx.dto.FpbTrace;
import com.kernelx.dto.FpbTraceSummary;
import com.kernelx.model.GanttSegment;
import com.kernelx.model.ProcessMetrics;
import com.kernelx.model.SchedulingAlgorithm;
import com.kernelx.model.SchedulingProcess;
import com.kernelx.model.SchedulingResult;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Deterministic, Spring-independent schedulers. Ready-set operations use KernelX's custom queue/heap. */
public final class SchedulingService {
    static final class Work {
        private final SchedulingProcess process;
        private int remaining;
        private int firstStart = -1;
        private int completion = -1;
        Work(SchedulingProcess process) { this.process = process; this.remaining = process.burstTime(); }
        private HeapEntrySnapshot snapshot() {
            return new HeapEntrySnapshot(process.pid(), process.name(), process.priority(),
                    process.arrivalTime(), process.burstTime(), remaining);
        }
        com.kernelx.dto.FpbProcessSnapshot fpbSnapshot() {
            return new com.kernelx.dto.FpbProcessSnapshot(process.pid(), process.name(), process.priority(),
                    process.arrivalTime(), process.burstTime(), remaining);
        }
    }

    private interface ReadySet {
        void offer(Work work);
        Work poll();
        Work peek();
        boolean isEmpty();
        default void simulationTime(int time) { }
        default List<HeapEntrySnapshot> snapshot() { return List.of(); }
        default void complete() { }
    }

    private static final class FifoReady implements ReadySet {
        private final CustomQueue<Work> queue;
        private final FpbTraceRecorder.RunSession trace;
        private FifoReady(FpbTraceRecorder.RunSession trace) {
            this.trace = trace;
            this.queue = new CustomQueue<>(trace);
            trace.beginQueue(queue.snapshot(512));
        }
        public void offer(Work work) { queue.enqueue(work); }
        public Work poll() { return queue.dequeue(); }
        public Work peek() { return queue.peek(); }
        public boolean isEmpty() { return queue.isEmpty(); }
        @Override public void complete() { trace.complete(queue.snapshot(512)); }
    }

    private static final class HeapReady implements ReadySet {
        private final MaxHeap<Work> heap;
        private final HeapTraceRecorder.RunSession trace;
        private HeapReady(Comparator<Work> order, HeapTraceRecorder.RunSession trace) {
            this.trace = trace;
            heap = new MaxHeap<>(order, new MaxHeap.Observer<>() {
                @Override public void onHeapify(List<Work> values) { trace.heapify(values.stream().map(Work::snapshot).toList()); }
                @Override public void onInsert(Work value, int index, int sizeBefore) { trace.insert(value.snapshot(), index, sizeBefore); }
                @Override public void onExtractMax(Work maximum, Work replacement, int sizeBefore) { trace.extract(maximum.snapshot(), replacement == null ? null : replacement.snapshot(), sizeBefore); }
                @Override public void onUpdate(Work previous, Work replacement, int index) { trace.update(previous.snapshot(), replacement.snapshot(), index); }
                @Override public void onCompare(int leftIndex, Work left, int rightIndex, Work right, int result, String phase) { trace.compare(leftIndex, left.snapshot(), rightIndex, right.snapshot(), result, phase); }
                @Override public void onSwap(int leftIndex, Work left, int rightIndex, Work right) { trace.swap(leftIndex, left.snapshot(), rightIndex, right.snapshot()); }
            });
        }
        public void offer(Work work) { heap.insert(work); }
        public Work poll() { return heap.extractMax(); }
        public Work peek() { return heap.peekMax(); }
        public boolean isEmpty() { return heap.isEmpty(); }
        @Override public void simulationTime(int time) { trace.setSimulationTime(time); }
        @Override public List<HeapEntrySnapshot> snapshot() { return heap.snapshot().stream().map(Work::snapshot).toList(); }
    }

    private final HeapTraceRecorder heapTraces;
    private final FpbTraceRecorder fpbTraces;

    public SchedulingService() { this(new HeapTraceRecorder(), new FpbTraceRecorder()); }
    public SchedulingService(HeapTraceRecorder heapTraces) { this(heapTraces, new FpbTraceRecorder()); }
    public SchedulingService(HeapTraceRecorder heapTraces, FpbTraceRecorder fpbTraces) {
        this.heapTraces = Objects.requireNonNull(heapTraces, "heapTraces");
        this.fpbTraces = Objects.requireNonNull(fpbTraces, "fpbTraces");
    }

    public FpbLiveSnapshot fpbSnapshot() { return fpbTraces.liveSnapshot(); }
    public List<FpbTraceSummary> fpbTraces() { return fpbTraces.listTraces(); }
    public Optional<FpbTrace> fpbTrace(String traceId) { return fpbTraces.getTrace(traceId); }

    public SchedulingResult fcfs(List<SchedulingProcess> processes) {
        return run(processes, SchedulingAlgorithm.FCFS, 0, false);
    }

    /** Non-preemptive shortest original burst among processes that have arrived. */
    public SchedulingResult sjf(List<SchedulingProcess> processes) {
        return run(processes, SchedulingAlgorithm.SJF, 0, false);
    }

    public SchedulingResult roundRobin(List<SchedulingProcess> processes, int timeQuantum) {
        if (timeQuantum <= 0) throw new IllegalArgumentException("Round Robin time quantum must be positive");
        return run(processes, SchedulingAlgorithm.ROUND_ROBIN, timeQuantum, false);
    }

    /** Higher numeric priority wins. Ties prefer earlier arrival, then lower PID. */
    public SchedulingResult priority(List<SchedulingProcess> processes, boolean preemptive) {
        return run(processes, SchedulingAlgorithm.PRIORITY, 0, preemptive);
    }

    public SchedulingResult schedule(List<SchedulingProcess> processes, SchedulingAlgorithm algorithm,
                                     int timeQuantum, boolean preemptivePriority) {
        Objects.requireNonNull(algorithm, "algorithm");
        return switch (algorithm) {
            case FCFS -> fcfs(processes);
            case SJF -> sjf(processes);
            case ROUND_ROBIN -> roundRobin(processes, timeQuantum);
            case PRIORITY -> priority(processes, preemptivePriority);
        };
    }

    private SchedulingResult run(List<SchedulingProcess> input, SchedulingAlgorithm algorithm,
                                 int quantum, boolean preemptive) {
        Objects.requireNonNull(input, "processes");
        Work[] arrivals = new Work[input.size()];
        for (int i = 0; i < input.size(); i++) arrivals[i] = new Work(Objects.requireNonNull(input.get(i), "process"));
        ensureUniquePids(arrivals);
        Arrays.sort(arrivals, Comparator.comparingInt((Work w) -> w.process.arrivalTime())
                .thenComparingInt(w -> w.process.pid()));

        HeapTraceRecorder.RunSession heapTrace = algorithm == SchedulingAlgorithm.SJF || algorithm == SchedulingAlgorithm.PRIORITY
                ? heapTraces.beginRun(algorithm, preemptive, arrivals.length) : null;
        FpbTraceRecorder.RunSession fpbTrace = algorithm == SchedulingAlgorithm.FCFS || algorithm == SchedulingAlgorithm.ROUND_ROBIN
                ? fpbTraces.beginRun(algorithm, arrivals.length) : null;
        ReadySet ready = createReadySet(algorithm, heapTrace, fpbTrace);
        List<GanttSegment> gantt = new ArrayList<>();
        int nextArrival = 0, completed = 0, time = 0, quantumUsed = 0;
        Work running = null;

        while (completed < arrivals.length) {
            ready.simulationTime(time);
            while (nextArrival < arrivals.length && arrivals[nextArrival].process.arrivalTime() <= time) {
                ready.offer(arrivals[nextArrival++]);
            }

            if (algorithm == SchedulingAlgorithm.PRIORITY && preemptive && running != null
                    && !ready.isEmpty() && ready.peek().process.priority() > running.process.priority()) {
                ready.offer(running);
                running = null;
                quantumUsed = 0;
            }

            if (running == null && !ready.isEmpty()) {
                running = ready.poll();
                quantumUsed = 0;
                if (running.firstStart < 0) running.firstStart = time;
            }

            if (running == null) {
                if (nextArrival >= arrivals.length) break;
                int idleEnd = arrivals[nextArrival].process.arrivalTime();
                appendSegment(gantt, GanttSegment.idle(time, idleEnd));
                time = idleEnd;
                continue;
            }

            appendSegment(gantt, new GanttSegment(running.process.pid(), running.process.name(),
                    time, time + 1, 1, false));
            running.remaining--;
            time++;
            if (running.remaining == 0) {
                running.completion = time;
                running = null;
                quantumUsed = 0;
                completed++;
            } else if (algorithm == SchedulingAlgorithm.ROUND_ROBIN && ++quantumUsed == quantum) {
                // Arrivals at the quantum boundary join the queue before the expired process.
                while (nextArrival < arrivals.length && arrivals[nextArrival].process.arrivalTime() <= time) {
                    ready.offer(arrivals[nextArrival++]);
                }
                ready.offer(running);
                running = null;
                quantumUsed = 0;
            }
        }

        ready.complete();
        if (heapTrace != null) heapTrace.complete(ready.snapshot());

        List<ProcessMetrics> metrics = new ArrayList<>(arrivals.length);
        double waiting = 0, turnaround = 0, response = 0;
        for (Work work : arrivals) {
            int turn = work.completion - work.process.arrivalTime();
            int wait = turn - work.process.burstTime();
            int respond = work.firstStart - work.process.arrivalTime();
            metrics.add(new ProcessMetrics(work.process.pid(), work.process.name(), work.completion, turn, wait, respond));
            waiting += wait;
            turnaround += turn;
            response += respond;
        }
        metrics.sort(Comparator.comparingInt(ProcessMetrics::pid));
        int count = metrics.size();
        return new SchedulingResult(algorithm, preemptive, quantum, gantt, metrics,
                count == 0 ? 0 : waiting / count,
                count == 0 ? 0 : turnaround / count,
                count == 0 ? 0 : response / count,
                time);
    }

    private ReadySet createReadySet(SchedulingAlgorithm algorithm, HeapTraceRecorder.RunSession trace,
                                    FpbTraceRecorder.RunSession fpbTrace) {
        return switch (algorithm) {
            case FCFS, ROUND_ROBIN -> new FifoReady(fpbTrace);
            case SJF -> new HeapReady((left, right) -> {
                int comparison = Integer.compare(right.process.burstTime(), left.process.burstTime());
                if (comparison == 0) comparison = Integer.compare(right.process.arrivalTime(), left.process.arrivalTime());
                if (comparison == 0) comparison = Integer.compare(right.process.pid(), left.process.pid());
                return comparison;
            }, trace);
            case PRIORITY -> new HeapReady((left, right) -> {
                int comparison = Integer.compare(left.process.priority(), right.process.priority());
                if (comparison == 0) comparison = Integer.compare(right.process.arrivalTime(), left.process.arrivalTime());
                if (comparison == 0) comparison = Integer.compare(right.process.pid(), left.process.pid());
                return comparison;
            }, trace);
        };
    }

    private void ensureUniquePids(Work[] processes) {
        for (int i = 0; i < processes.length; i++) {
            for (int j = i + 1; j < processes.length; j++) {
                if (processes[i].process.pid() == processes[j].process.pid()) {
                    throw new IllegalArgumentException("Duplicate PID: " + processes[i].process.pid());
                }
            }
        }
    }

    private void appendSegment(List<GanttSegment> segments, GanttSegment segment) {
        if (!segments.isEmpty()) {
            GanttSegment last = segments.get(segments.size() - 1);
            if (last.pid() == segment.pid() && last.endTime() == segment.startTime()) {
                segments.set(segments.size() - 1, new GanttSegment(last.pid(), last.processName(),
                        last.startTime(), segment.endTime(), segment.endTime() - last.startTime(), last.idle()));
                return;
            }
        }
        segments.add(segment);
    }
}
