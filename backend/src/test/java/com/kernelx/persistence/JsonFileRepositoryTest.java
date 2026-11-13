package com.kernelx.persistence;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.model.SystemEvent;
import com.kernelx.model.SystemEventType;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class JsonFileRepositoryTest {
    @TempDir Path tempDir;
    private ObjectMapper mapper() { return new ObjectMapper().findAndRegisterModules(); }

    @Test void createsMissingFileAndPersistsStructuredRecords() throws IOException {
        Path file = tempDir.resolve("events.json");
        JsonFileRepository<SystemEvent> repository = new JsonFileRepository<>(file, SystemEvent.class, mapper());
        assertTrue(Files.exists(file));
        assertTrue(repository.findAll().isEmpty());
        SystemEvent event = new SystemEvent(1, 3, 42, SystemEventType.SCHEDULING_DECISION, "selected");
        repository.append(event);
        assertEquals(List.of(event), repository.findAll());
        assertTrue(Files.readString(file).contains("SCHEDULING_DECISION"));
    }

    @Test void quarantinesCorruptJsonWithoutDiscardingOriginalContents() throws IOException {
        Path file = tempDir.resolve("simulations.json");
        String damaged = "[{ this is not valid JSON";
        Files.writeString(file, damaged);
        JsonFileRepository<SystemEvent> repository = new JsonFileRepository<>(file, SystemEvent.class, mapper());
        assertTrue(repository.findAll().isEmpty());
        assertTrue(mapper().readTree(file.toFile()).isArray());
        assertEquals(0, mapper().readTree(file.toFile()).size());
        List<Path> quarantined;
        try (var files = Files.list(tempDir)) {
            quarantined = files.filter(path -> path.getFileName().toString().contains(".corrupt-")).toList();
        }
        assertEquals(1, quarantined.size());
        assertEquals(damaged, Files.readString(quarantined.getFirst()));
    }

    @Test void quarantinesValidJsonThatIsNotARecordArray() throws IOException {
        Path file = tempDir.resolve("configs.json");
        Files.writeString(file, "[null]");
        JsonFileRepository<SystemEvent> repository = new JsonFileRepository<>(file, SystemEvent.class, mapper());
        assertTrue(repository.findAll().isEmpty());
        try (var files = Files.list(tempDir)) {
            assertTrue(files.anyMatch(path -> path.getFileName().toString().contains(".corrupt-")));
        }
    }

    @Test void serializesConcurrentWritersAndLeavesValidJson() throws Exception {
        JsonFileRepository<SystemEvent> repository = new JsonFileRepository<>(
                tempDir.resolve("event_logs.json"), SystemEvent.class, mapper());
        var executor = Executors.newFixedThreadPool(8);
        try {
            List<java.util.concurrent.Future<?>> writes = new ArrayList<>();
            for (int i = 1; i <= 64; i++) {
                final int id = i;
                writes.add(executor.submit(() -> repository.append(new SystemEvent(id, id, id,
                        SystemEventType.PROCESS_CREATED, UUID.randomUUID().toString()))));
            }
            for (var write : writes) write.get(10, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
        }
        assertEquals(64, repository.findAll().size());
        assertDoesNotThrow(() -> mapper().readTree(repository.filePath().toFile()));
    }
}
