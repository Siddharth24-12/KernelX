package com.kernelx.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
class Phase3ApiIntegrationTest {
    private static final Path TEST_DATA = createTestDirectory();
    private static final String ORIGIN = "http://localhost:5173";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @DynamicPropertySource
    static void dataDirectory(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> TEST_DATA.toString());
    }

    @Test void exercisesProcessSimulationMemoryEventsPersistenceValidationAndCors() throws Exception {
        mvc.perform(get("/api/processes/tree")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(options("/api/processes")
                        .header("Origin", ORIGIN)
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", ORIGIN));

        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pid":101,"name":"compiler","priority":2,"arrivalTime":0,"burstTime":3,"memoryRequirement":32}
                                """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.state").value("NEW"));
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pid":102,"name":"indexer","priority":2,"arrivalTime":1,"burstTime":2,"memoryRequirement":16,"parentPid":101}
                                """))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pid":103,"name":"temporary","priority":1,"arrivalTime":0,"burstTime":1,"memoryRequirement":8}
                                """))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pid":104,"name":"invalid","priority":1,"arrivalTime":0,"burstTime":0,"memoryRequirement":8}
                                """))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.status").value(400));
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pid":101,"name":"duplicate","priority":1,"arrivalTime":0,"burstTime":1,"memoryRequirement":1}
                                """))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/processes")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(3)));
        mvc.perform(get("/api/processes/tree")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pid").value(101)).andExpect(jsonPath("$[0].name").value("compiler"))
                .andExpect(jsonPath("$[0].state").value("NEW"))
                .andExpect(jsonPath("$[0].children[0].pid").value(102))
                .andExpect(jsonPath("$[0].children[0].parentPid").value(101));
        mvc.perform(get("/api/processes/101")).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("compiler"));
        mvc.perform(get("/api/processes/999")).andExpect(status().isNotFound());
        mvc.perform(patch("/api/processes/102/priority").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"priority\":5}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.priority").value(5));
        mvc.perform(patch("/api/processes/102/priority").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"priority\":12}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/processes/102/pause")).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("PAUSED"));
        mvc.perform(post("/api/processes/102/resume")).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("READY"));
        mvc.perform(delete("/api/processes/103")).andExpect(status().isNoContent());
        mvc.perform(get("/api/processes/103")).andExpect(status().isNotFound());

        mvc.perform(get("/api/memory")).andExpect(status().isOk()).andExpect(jsonPath("$.totalMemory").value(1024));
        mvc.perform(post("/api/memory/allocate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":101,\"strategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.memory.allocatedMemory").value(32));
        mvc.perform(post("/api/memory/deallocate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":101}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.memory.freeMemory").value(1024));
        mvc.perform(post("/api/memory/deallocate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":999}"))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"algorithm":"ROUND_ROBIN","timeQuantum":1,"preemptivePriority":false,"totalMemory":256,"memoryAllocationStrategy":"BEST_FIT","speed":2.0}
                                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RUNNING"));
        mvc.perform(post("/api/simulations/save").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"not complete\"}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/simulation/scheduling")).andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("ROUND_ROBIN"));
        mvc.perform(get("/api/simulation/gantt")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(5)));
        mvc.perform(get("/api/simulation/metrics")).andExpect(status().isOk())
                .andExpect(jsonPath("$.processes", hasSize(2))).andExpect(jsonPath("$.averageWaitingTime").exists());
        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentTime").value(1));
        mvc.perform(post("/api/simulation/pause")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PAUSED"));
        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":1}"))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/processes/101/priority").contentType(MediaType.APPLICATION_JSON).content("{\"priority\":3}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/simulation/resume")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RUNNING"));
        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":20}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(post("/api/simulation/pause")).andExpect(status().isConflict());
        mvc.perform(get("/api/simulation/state")).andExpect(status().isOk()).andExpect(jsonPath("$.currentTime").value(5));

        mvc.perform(get("/api/simulation/events?pid=101")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(org.hamcrest.Matchers.greaterThan(0))));
        mvc.perform(get("/api/simulation/events?type=NOT_AN_EVENT")).andExpect(status().isBadRequest());
        assertTrue(Files.size(TEST_DATA.resolve("event_logs.json")) > 2);

        String savedSimulationBody = mvc.perform(post("/api/simulations/save").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"RR sample\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.scheduling.algorithm").value("ROUND_ROBIN"))
                .andReturn().getResponse().getContentAsString();
        String simulationId = mapper.readTree(savedSimulationBody).get("id").asText();
        mvc.perform(get("/api/simulations")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/simulations/" + simulationId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.processes", hasSize(2)));
        mvc.perform(delete("/api/simulations/" + simulationId)).andExpect(status().isNoContent());
        mvc.perform(get("/api/simulations/" + simulationId)).andExpect(status().isNotFound());
        String savedConfigurationBody = mvc.perform(post("/api/configurations").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"RR config","algorithm":"ROUND_ROBIN","timeQuantum":2,"preemptivePriority":false,"totalMemory":512,"memoryAllocationStrategy":"WORST_FIT","speed":1.5}
                                """))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        JsonNode savedConfiguration = mapper.readTree(savedConfigurationBody);
        String configurationId = savedConfiguration.get("id").asText();
        mvc.perform(get("/api/configurations")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/configurations/" + configurationId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.simulation.timeQuantum").value(2));
        mvc.perform(delete("/api/configurations/" + configurationId)).andExpect(status().isNoContent());
        mvc.perform(get("/api/configurations/" + configurationId)).andExpect(status().isNotFound());

        mvc.perform(post("/api/simulation/reset")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("READY"));
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"ROUND_ROBIN\",\"timeQuantum\":0,\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/simulation/pause")).andExpect(status().isConflict());
    }

    private static Path createTestDirectory() {
        try { return Files.createTempDirectory("kernelx-api-test-" + UUID.randomUUID()); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
