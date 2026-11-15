package com.kernelx.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
class WorkloadIntegrityIntegrationTest {
    private static final Path DATA = temporaryDirectory();
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> DATA.toString());
    }

    @Test void invalidPersistedWorkloadIsRejectedBeforeAnyProcessIsLoaded() throws Exception {
        String body = """
                {"name":"Integrity check","description":"","processes":[
                  {"pid":92001,"name":"root","priority":5,"arrivalTime":0,"burstTime":3,"memoryRequirement":32,"parentPid":-1},
                  {"pid":92002,"name":"child","priority":4,"arrivalTime":0,"burstTime":2,"memoryRequirement":32,"parentPid":92001}],
                  "algorithm":"FCFS","timeQuantum":0,"preemptivePriority":false,"totalMemory":256,
                  "memoryAllocationStrategy":"FIRST_FIT","speed":1.0}
                """;
        String created = mvc.perform(post("/api/workloads").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String id = mapper.readTree(created).get("id").asText();

        ObjectNode persisted = (ObjectNode) mapper.readTree(Files.readString(DATA.resolve("workloads.json"))).get(0);
        ((ObjectNode) persisted.withArray("processes").get(1)).put("burstTime", 0);
        mapper.writeValue(DATA.resolve("workloads.json").toFile(), mapper.createArrayNode().add(persisted));

        mvc.perform(post("/api/workloads/{id}/load", id)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("burst time must be positive")));
        mvc.perform(get("/api/processes")).andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(0)));
        mvc.perform(get("/api/dsa/ptu/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(0));
    }

    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("kernelx-workload-integrity-" + UUID.randomUUID()); }
        catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }
}
