package com.kernelx.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.model.SystemEvent;
import com.kernelx.persistence.JsonFileRepository;
import java.nio.file.Path;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public final class EventLogPersistenceService {
    private final JsonFileRepository<SystemEvent> repository;

    public EventLogPersistenceService(ObjectMapper mapper,
                                     @Value("${kernelx.data-directory:data}") String dataDirectory) {
        repository = new JsonFileRepository<>(Path.of(dataDirectory).resolve("event_logs.json"), SystemEvent.class, mapper);
    }

    public void append(SystemEvent event) { repository.append(event); }
    public List<SystemEvent> findAll() { return repository.findAll(); }
}
