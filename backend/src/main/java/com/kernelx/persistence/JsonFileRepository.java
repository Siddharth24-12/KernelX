package com.kernelx.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Synchronized JSON-array repository with corruption quarantine and atomic replacement writes. */
public final class JsonFileRepository<T> {
    private static final Logger LOGGER = LoggerFactory.getLogger(JsonFileRepository.class);

    private final Path file;
    private final ObjectMapper mapper;
    private final JavaType listType;

    public JsonFileRepository(Path file, Class<T> itemType, ObjectMapper mapper) {
        this.file = file.toAbsolutePath().normalize();
        this.mapper = mapper;
        this.listType = mapper.getTypeFactory().constructCollectionType(ArrayList.class, itemType);
        ensureFile();
    }

    public synchronized List<T> findAll() {
        ensureFile();
        try {
            List<T> rows = mapper.readValue(file.toFile(), listType);
            if (rows == null || rows.stream().anyMatch(java.util.Objects::isNull)) {
                quarantineCorruptFile(new IOException("Expected a JSON array containing non-null records"));
                writeAll(List.of());
                return List.of();
            }
            return List.copyOf(rows);
        } catch (JsonProcessingException exception) {
            quarantineCorruptFile(exception);
            writeAll(List.of());
            return List.of();
        } catch (IOException exception) {
            throw new PersistenceException("Could not read JSON storage", exception);
        }
    }

    public synchronized void saveAll(List<T> rows) {
        writeAll(List.copyOf(rows));
    }

    public synchronized void append(T row) {
        List<T> rows = new ArrayList<>(findAll());
        rows.add(row);
        writeAll(rows);
    }

    public synchronized boolean removeIf(Predicate<T> condition) {
        List<T> rows = new ArrayList<>(findAll());
        boolean removed = rows.removeIf(condition);
        if (removed) writeAll(rows);
        return removed;
    }

    public Path filePath() { return file; }

    private void ensureFile() {
        if (Files.exists(file)) return;
        try {
            Files.createDirectories(file.getParent());
            writeAll(List.of());
        } catch (IOException exception) {
            throw new PersistenceException("Could not create JSON storage", exception);
        }
    }

    private void quarantineCorruptFile(Exception cause) {
        Path backup = file.resolveSibling(file.getFileName() + ".corrupt-" + UUID.randomUUID() + ".json");
        try {
            try {
                Files.move(file, backup, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(file, backup, StandardCopyOption.REPLACE_EXISTING);
            }
            LOGGER.warn("Invalid JSON storage was moved to {} and reset to an empty array", backup.getFileName());
        } catch (IOException exception) {
            exception.addSuppressed(cause);
            throw new PersistenceException("Could not quarantine corrupted JSON storage", exception);
        }
    }

    private void writeAll(List<T> rows) {
        Path temporary = file.resolveSibling(file.getFileName() + "." + UUID.randomUUID() + ".tmp");
        try {
            Files.createDirectories(file.getParent());
            byte[] data = mapper.writerFor(listType).withDefaultPrettyPrinter().writeValueAsBytes(new ArrayList<>(rows));
            Files.write(temporary, data, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
            try (FileChannel channel = FileChannel.open(temporary, StandardOpenOption.WRITE)) {
                channel.force(true);
            }
            try {
                Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(temporary, file, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            try { Files.deleteIfExists(temporary); } catch (IOException cleanup) { exception.addSuppressed(cleanup); }
            throw new PersistenceException("Could not write JSON storage", exception);
        }
    }
}
