package com.kernelx.service;

import com.kernelx.dsa.CustomQueue;
import com.kernelx.model.SystemEvent;
import com.kernelx.model.SystemEventType;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

/** In-memory typed event history. Appending is O(1), snapshotting is O(n). */
public final class EventManager {
    private CustomQueue<SystemEvent> events = new CustomQueue<>();
    private long nextId;
    private int simulationTime;
    private final Consumer<SystemEvent> persistenceSink;

    public EventManager() { this(event -> { }, 1); }

    public EventManager(Consumer<SystemEvent> persistenceSink) { this(persistenceSink, 1); }

    public EventManager(Consumer<SystemEvent> persistenceSink, long firstEventId) {
        this.persistenceSink = Objects.requireNonNull(persistenceSink, "persistenceSink");
        if (firstEventId <= 0) throw new IllegalArgumentException("First event ID must be positive");
        this.nextId = firstEventId;
    }

    public synchronized SystemEvent record(Integer pid, SystemEventType type, String description) {
        SystemEvent event = new SystemEvent(nextId++, simulationTime, pid, type, description);
        events.enqueue(event);
        persistenceSink.accept(event);
        return event;
    }

    public synchronized List<SystemEvent> snapshot() {
        List<SystemEvent> result = new ArrayList<>(events.size());
        events.traverse(result::add);
        return List.copyOf(result);
    }

    public synchronized void setSimulationTime(int simulationTime) {
        if (simulationTime < 0) throw new IllegalArgumentException("Simulation time must not be negative");
        this.simulationTime = simulationTime;
    }

    public synchronized int size() { return events.size(); }

    public synchronized void clear() {
        events = new CustomQueue<>();
        nextId = 1;
    }
}
