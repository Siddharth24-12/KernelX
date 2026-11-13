package com.kernelx.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.SaveConfigurationRequest;
import com.kernelx.dto.SavedConfiguration;
import com.kernelx.model.SimulationConfiguration;
import com.kernelx.persistence.JsonFileRepository;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public final class ConfigurationStoreService {
    private final JsonFileRepository<SavedConfiguration> repository;

    public ConfigurationStoreService(ObjectMapper mapper,
                                     @Value("${kernelx.data-directory:data}") String dataDirectory) {
        repository = new JsonFileRepository<>(Path.of(dataDirectory).resolve("configurations.json"),
                SavedConfiguration.class, mapper);
    }

    public synchronized SavedConfiguration save(SaveConfigurationRequest request) {
        SimulationConfiguration simulation = new SimulationConfiguration(request.algorithm(), request.timeQuantum(),
                request.preemptivePriority());
        SavedConfiguration configuration = new SavedConfiguration(UUID.randomUUID().toString(), request.name(),
                Instant.now(), simulation, request.totalMemory(), request.memoryAllocationStrategy(), request.speed());
        repository.append(configuration);
        return configuration;
    }

    public synchronized List<SavedConfiguration> findAll() { return repository.findAll(); }

    public synchronized SavedConfiguration findById(String id) {
        return repository.findAll().stream().filter(item -> item.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Configuration " + id + " was not found"));
    }

    public synchronized void delete(String id) {
        if (!repository.removeIf(item -> item.id().equals(id))) {
            throw new ResourceNotFoundException("Configuration " + id + " was not found");
        }
    }
}
