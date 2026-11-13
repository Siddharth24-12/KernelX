package com.kernelx.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.SavedProcessSnapshot;
import com.kernelx.dto.SavedSimulation;
import com.kernelx.model.SimulationStatus;
import com.kernelx.persistence.JsonFileRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public final class SimulationArchiveService {
    private final JsonFileRepository<SavedSimulation> repository;
    private final SimulationRuntimeService runtime;

    public SimulationArchiveService(ObjectMapper mapper,
                                    @Value("${kernelx.data-directory:data}") String dataDirectory,
                                    SimulationRuntimeService runtime) {
        repository = new JsonFileRepository<>(Path.of(dataDirectory).resolve("simulations.json"), SavedSimulation.class, mapper);
        this.runtime = runtime;
    }

    public synchronized SavedSimulation save(String name) {
        if (runtime.status() != SimulationStatus.COMPLETED) {
            throw new ConflictException("Only completed simulations can be saved");
        }
        var scheduling = runtime.scheduling();
        List<SavedProcessSnapshot> processSnapshots = runtime.processSnapshots().stream()
                .map(SavedProcessSnapshot::from).toList();
        SavedSimulation simulation = new SavedSimulation(UUID.randomUUID().toString(), name, Instant.now(),
                scheduling, processSnapshots, runtime.memory(), runtime.events());
        repository.append(simulation);
        return simulation;
    }

    public synchronized List<SavedSimulation> findAll() { return repository.findAll(); }

    public synchronized SavedSimulation findById(String id) {
        return repository.findAll().stream().filter(item -> item.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Saved simulation " + id + " was not found"));
    }

    public synchronized void delete(String id) {
        if (!repository.removeIf(item -> item.id().equals(id))) {
            throw new ResourceNotFoundException("Saved simulation " + id + " was not found");
        }
    }
}
