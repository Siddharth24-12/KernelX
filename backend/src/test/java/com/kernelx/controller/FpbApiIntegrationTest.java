package com.kernelx.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
class FpbApiIntegrationTest {
    private static final Path TEST_DATA = createTestDirectory();
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;
    @DynamicPropertySource static void dataDirectory(DynamicPropertyRegistry registry) { registry.add("kernelx.data-directory", () -> TEST_DATA.toString()); }

    @Test void recordsOnlyRealFifoSchedulerRunsAndDiagnosticReadsAreReadOnly() throws Exception {
        mvc.perform(get("/api/dsa/fpb/snapshot")).andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false)).andExpect(jsonPath("$.queue").value(org.hamcrest.Matchers.nullValue()));
        create(811, "long", 3); create(812, "short", 1);
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"algorithm\":\"FCFS\",\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.algorithm").value("FCFS"));
        JsonNode summaries = traces();
        assertEquals(1, summaries.size(), "simulation start also records an event, but the EventManager queue must not appear in FPB history");
        JsonNode fcfs = summaries.get(0);
        String fcfsId = fcfs.path("traceId").asText();
        assertEquals("FCFS", fcfs.path("algorithm").asText());
        assertTrue(fcfs.path("complete").asBoolean());
        assertEquals(4, fcfs.path("operationCount").asInt());
        mvc.perform(get("/api/dsa/fpb/traces/{id}", fcfsId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.schedulingRunId").isNotEmpty())
                .andExpect(jsonPath("$.steps[0].operation").value("ENQUEUE"))
                .andExpect(jsonPath("$.steps[2].operation").value("DEQUEUE"))
                .andExpect(jsonPath("$.steps[1].queueAfter.nodes[0].process.pid").value(811))
                .andExpect(jsonPath("$.steps[1].queueAfter.nodes[1].process.pid").value(812))
                .andExpect(jsonPath("$.finalQueue.size").value(0));

        for (int i = 0; i < 6; i++) {
            mvc.perform(get("/api/dsa/fpb/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
            mvc.perform(get("/api/dsa/fpb/traces")).andExpect(status().isOk());
            mvc.perform(get("/api/dsa/fpb/traces/{id}", fcfsId)).andExpect(status().isOk());
        }
        assertEquals(1, traces().size(), "snapshot/list/detail polling must not invoke queue operations");

        mvc.perform(post("/api/simulation/reset")).andExpect(status().isOk());
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"algorithm\":\"ROUND_ROBIN\",\"timeQuantum\":1,\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.algorithm").value("ROUND_ROBIN"));
        JsonNode afterRr = traces();
        assertEquals(2, afterRr.size());
        JsonNode rr = afterRr.get(1);
        assertEquals("ROUND_ROBIN", rr.path("algorithm").asText());
        assertNotEquals(fcfs.path("schedulingRunId").asText(), rr.path("schedulingRunId").asText());
        assertNotEquals(fcfsId, rr.path("traceId").asText());
        String rrId = rr.path("traceId").asText();
        mvc.perform(get("/api/dsa/fpb/traces/{id}", rrId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[?(@.operation == 'ENQUEUE' && @.pid == 811)]").value(org.hamcrest.Matchers.hasSize(3)));

        mvc.perform(post("/api/simulation/reset")).andExpect(status().isOk());
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"algorithm\":\"SJF\",\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk());
        assertEquals(2, traces().size(), "heap-based scheduling must not fabricate FIFO traces");
        mvc.perform(get("/api/dsa/fpb/traces/not-a-trace")).andExpect(status().isNotFound());
    }

    private void create(int pid, String name, int burst) throws Exception {
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pid\":%d,\"name\":\"%s\",\"priority\":4,\"arrivalTime\":0,\"burstTime\":%d,\"memoryRequirement\":32}".formatted(pid, name, burst)))
                .andExpect(status().isCreated());
    }
    private JsonNode traces() throws Exception {
        String json = mvc.perform(get("/api/dsa/fpb/traces")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }
    private static Path createTestDirectory() {
        try { return Files.createTempDirectory("kernelx-fpb-" + UUID.randomUUID()); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
