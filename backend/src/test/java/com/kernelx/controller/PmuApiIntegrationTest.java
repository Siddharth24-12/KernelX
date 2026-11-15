package com.kernelx.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
class PmuApiIntegrationTest {
    private static final Path TEST_DATA = createTestDirectory();
    @Autowired private MockMvc mvc;

    @DynamicPropertySource
    static void dataDirectory(DynamicPropertyRegistry registry) { registry.add("kernelx.data-directory", () -> TEST_DATA.toString()); }

    @Test void exposesActualLiveListAndHistoricalOperationsWithoutDiagnosticMutation() throws Exception {
        mvc.perform(get("/api/dsa/pmu/snapshot")).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(0)).andExpect(jsonPath("$.headNodeId").value(org.hamcrest.Matchers.nullValue()));
        createProcess(701, "first"); createProcess(702, "middle"); createProcess(703, "last");

        String liveBefore = mvc.perform(get("/api/dsa/pmu/snapshot")).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(3)).andExpect(jsonPath("$.nodes[0].pid").value(701))
                .andExpect(jsonPath("$.nodes[1].pid").value(702)).andExpect(jsonPath("$.nodes[2].pid").value(703))
                .andReturn().getResponse().getContentAsString();
        java.util.List<com.kernelx.dto.PmuTraceSummary> afterInsert = getTraces();
        assertTrue(afterInsert.stream().anyMatch(t -> "INSERT".equals(t.operation()) && Integer.valueOf(702).equals(t.targetPid())));
        int countBeforeReads = afterInsert.size();

        for (int i = 0; i < 5; i++) {
            mvc.perform(get("/api/dsa/pmu/snapshot")).andExpect(status().isOk()).andExpect(content().json(liveBefore));
            mvc.perform(get("/api/dsa/pmu/traces")).andExpect(status().isOk());
            mvc.perform(get("/api/processes")).andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(3)));
        }
        java.util.List<com.kernelx.dto.PmuTraceSummary> afterReads = getTraces();
        assertEquals(countBeforeReads, afterReads.size(), "PMU and process-list diagnostic reads must not create traversal traces");
        assertEquals(liveBefore, mvc.perform(get("/api/dsa/pmu/snapshot")).andReturn().getResponse().getContentAsString(),
                "diagnostic reads must not change live linked-list structure");

        String insertId = afterReads.stream().filter(t -> "INSERT".equals(t.operation()) && Integer.valueOf(702).equals(t.targetPid()))
                .findFirst().orElseThrow().traceId();
        mvc.perform(get("/api/dsa/pmu/traces/{id}", insertId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.beforeSnapshot.size").value(1)).andExpect(jsonPath("$.afterSnapshot.size").value(2))
                .andExpect(jsonPath("$.steps[?(@.kind == 'POINTER_UPDATE')]").isNotEmpty());
        mvc.perform(get("/api/dsa/pmu/traces/{id}", insertId)).andExpect(status().isOk());
        assertEquals(countBeforeReads, getTraces().size(), "individual historical trace reads must be read-only");

        mvc.perform(delete("/api/processes/702")).andExpect(status().isNoContent());
        mvc.perform(get("/api/dsa/pmu/snapshot")).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(2)).andExpect(jsonPath("$.nodes[0].pid").value(701))
                .andExpect(jsonPath("$.nodes[0].nextNodeId").value(3)).andExpect(jsonPath("$.nodes[1].pid").value(703));
        com.kernelx.dto.PmuTraceSummary deletion = getTraces().stream()
                .filter(t -> "DELETE".equals(t.operation()) && Integer.valueOf(702).equals(t.targetPid())).findFirst().orElseThrow();
        mvc.perform(get("/api/dsa/pmu/traces/{id}", deletion.traceId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.beforeSnapshot.size").value(3)).andExpect(jsonPath("$.afterSnapshot.size").value(2))
                .andExpect(jsonPath("$.steps[4].oldNextNodeId").value(2))
                .andExpect(jsonPath("$.steps[4].newNextNodeId").value(3));
        mvc.perform(get("/api/dsa/pmu/traces/missing")).andExpect(status().isNotFound());
    }

    private void createProcess(int pid, String name) throws Exception {
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pid\":%d,\"name\":\"%s\",\"priority\":4,\"arrivalTime\":0,\"burstTime\":2,\"memoryRequirement\":32}".formatted(pid, name)))
                .andExpect(status().isCreated());
    }
    private java.util.List<com.kernelx.dto.PmuTraceSummary> getTraces() throws Exception {
        String json = mvc.perform(get("/api/dsa/pmu/traces")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return java.util.Arrays.asList(new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules()
                .readValue(json, com.kernelx.dto.PmuTraceSummary[].class));
    }
    private static Path createTestDirectory() {
        try { return Files.createTempDirectory("kernelx-pmu-" + UUID.randomUUID()); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
