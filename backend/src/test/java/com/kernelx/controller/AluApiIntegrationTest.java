package com.kernelx.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kernelx.dto.AluTraceSummary;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class AluApiIntegrationTest {
    private static final Path TEST_DATA = createTestDirectory();
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @DynamicPropertySource static void dataDirectory(DynamicPropertyRegistry registry) { registry.add("kernelx.data-directory", () -> TEST_DATA.toString()); }

    @Test void exposesActualCollisionChainsAndReadOnlyDiagnosticEndpoints() throws Exception {
        mvc.perform(get("/api/dsa/alu/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.capacity").value(16));
        create(1, "one"); create(17, "seventeen"); create(33, "thirty-three");
        mvc.perform(get("/api/dsa/alu/snapshot")).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(3)).andExpect(jsonPath("$.buckets[1].chainLength").value(3))
                .andExpect(jsonPath("$.buckets[1].entries[0].pid").value(33))
                .andExpect(jsonPath("$.buckets[1].entries[1].pid").value(17))
                .andExpect(jsonPath("$.buckets[1].entries[2].pid").value(1));
        var traces = traces();
        assertTrue(traces.stream().anyMatch(t -> "PUT".equals(t.operation()) && t.pid() == 17 && t.bucketIndex() == 1));
        AluTraceSummary genuineCollision = traces.stream().filter(t -> "PUT".equals(t.operation()) && t.pid() == 17).findFirst().orElseThrow();
        mvc.perform(get("/api/dsa/alu/traces/{id}", genuineCollision.traceId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[?(@.kind == 'COLLISION')]").isNotEmpty())
                .andExpect(jsonPath("$.steps[?(@.kind == 'BUCKET_HEAD_UPDATED')]").isNotEmpty());

        mvc.perform(get("/api/processes/1")).andExpect(status().isOk());
        AluTraceSummary successfulGet = traces().stream().filter(t -> "GET".equals(t.operation()) && t.pid() == 1 && Boolean.TRUE.equals(t.result())).findFirst().orElseThrow();
        mvc.perform(get("/api/dsa/alu/traces/{id}", successfulGet.traceId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[?(@.kind == 'NODE_VISITED')]").value(org.hamcrest.Matchers.hasSize(3)))
                .andExpect(jsonPath("$.steps[?(@.kind == 'KEY_COMPARED')]").value(org.hamcrest.Matchers.hasSize(3)));
        mvc.perform(get("/api/processes/49")).andExpect(status().isNotFound());
        AluTraceSummary failedGet = traces().stream().filter(t -> "GET".equals(t.operation()) && t.pid() == 49 && Boolean.FALSE.equals(t.result())).findFirst().orElseThrow();
        mvc.perform(get("/api/dsa/alu/traces/{id}", failedGet.traceId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[?(@.kind == 'NODE_VISITED')]").value(org.hamcrest.Matchers.hasSize(3)))
                .andExpect(jsonPath("$.steps[?(@.kind == 'KEY_COMPARED')]").value(org.hamcrest.Matchers.hasSize(3)));

        int count = traces().size();
        String before = mvc.perform(get("/api/dsa/alu/snapshot")).andReturn().getResponse().getContentAsString();
        for (int i = 0; i < 5; i++) {
            mvc.perform(get("/api/dsa/alu/snapshot")).andExpect(status().isOk()).andExpect(content().json(before));
            mvc.perform(get("/api/dsa/alu/traces")).andExpect(status().isOk());
            mvc.perform(get("/api/processes")).andExpect(status().isOk());
            mvc.perform(get("/api/dsa/alu/traces/{id}", successfulGet.traceId())).andExpect(status().isOk());
        }
        assertEquals(count, traces().size(), "polling, trace lists and historical reads must be read only");

        mvc.perform(delete("/api/processes/17")).andExpect(status().isNoContent());
        AluTraceSummary deletion = traces().stream().filter(t -> "REMOVE".equals(t.operation()) && t.pid() == 17).findFirst().orElseThrow();
        mvc.perform(get("/api/dsa/alu/traces/{id}", deletion.traceId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[?(@.kind == 'NEXT_POINTER_UPDATED')]").isNotEmpty())
                .andExpect(jsonPath("$.beforeSnapshot.size").value(3)).andExpect(jsonPath("$.afterSnapshot.size").value(2));
        String deletionJson = mvc.perform(get("/api/dsa/alu/traces/{id}", deletion.traceId())).andReturn().getResponse().getContentAsString();
        var pointer = mapper.readTree(deletionJson).path("steps").findParents("kind").stream()
                .filter(step -> "NEXT_POINTER_UPDATED".equals(step.path("kind").asText())).findFirst().orElse(null);
        assertNotNull(pointer);
        assertEquals(3L, pointer.get("ownerEntryId").asLong());
        assertEquals(2L, pointer.get("oldNextEntryId").asLong());
        assertEquals(1L, pointer.get("newNextEntryId").asLong());
        mvc.perform(get("/api/dsa/alu/traces/missing")).andExpect(status().isNotFound());
    }

    private void create(int pid, String name) throws Exception {
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pid\":%d,\"name\":\"%s\",\"priority\":4,\"arrivalTime\":0,\"burstTime\":2,\"memoryRequirement\":32}".formatted(pid, name)))
                .andExpect(status().isCreated());
    }
    private java.util.List<AluTraceSummary> traces() throws Exception {
        String json = mvc.perform(get("/api/dsa/alu/traces")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return Arrays.asList(mapper.findAndRegisterModules().readValue(json, AluTraceSummary[].class));
    }
    private static Path createTestDirectory() {
        try { return Files.createTempDirectory("kernelx-alu-" + UUID.randomUUID()); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
