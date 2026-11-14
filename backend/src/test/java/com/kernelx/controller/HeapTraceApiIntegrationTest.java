package com.kernelx.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
class HeapTraceApiIntegrationTest {
    private static final Path TEST_DATA = createTestDirectory();
    @Autowired private MockMvc mvc;

    @DynamicPropertySource
    static void dataDirectory(DynamicPropertyRegistry registry) { registry.add("kernelx.data-directory", () -> TEST_DATA.toString()); }

    @Test void schedulerHeapTraceSurvivesRunAndDiagnosticReadsAreReadOnly() throws Exception {
        createProcess(301, "low", 1); createProcess(302, "high", 5); createProcess(303, "middle", 3);
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"PRIORITY\",\"preemptivePriority\":false,\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.algorithm").value("PRIORITY"));

        String runId = mvc.perform(get("/api/dsa/heap/runs"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].algorithm").value("PRIORITY"))
                .andExpect(jsonPath("$[0].completedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.JsonNode summaries = new com.fasterxml.jackson.databind.ObjectMapper().readTree(runId);
        String id = summaries.get(0).get("runId").asText();
        mvc.perform(get("/api/dsa/heap/runs/{runId}", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value(id)).andExpect(jsonPath("$.algorithm").value("PRIORITY"))
                .andExpect(jsonPath("$.steps[?(@.kind == 'SWAP')].kind").isNotEmpty());
        mvc.perform(get("/api/dsa/heap/runs/{runId}", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.steps.length()").value(org.hamcrest.Matchers.greaterThan(3)));
        mvc.perform(get("/api/dsa/heap/runs/{runId}", "missing-run")).andExpect(status().isNotFound());
    }

    private void createProcess(int pid, String name, int priority) throws Exception {
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":%d,\"name\":\"%s\",\"priority\":%d,\"arrivalTime\":0,\"burstTime\":2,\"memoryRequirement\":32}".formatted(pid, name, priority)))
                .andExpect(status().isCreated());
    }

    private static Path createTestDirectory() {
        try { return Files.createTempDirectory("kernelx-heap-trace-" + UUID.randomUUID()); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
