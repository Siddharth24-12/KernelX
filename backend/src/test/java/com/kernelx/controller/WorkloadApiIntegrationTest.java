package com.kernelx.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class WorkloadApiIntegrationTest {
    private static final Path DATA = tempDirectory();
    @Autowired private MockMvc mvc;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> DATA.toString());
    }

    @Test void workloadTemplatesCrudValidationAndExecutionUseTheExistingScheduler() throws Exception {
        mvc.perform(get("/api/workloads/templates"))
                .andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(6)))
                .andExpect(jsonPath("$[0].id").value("builtin-short-jobs"));
        mvc.perform(get("/api/workloads/templates"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].processes[0].pid").value(61001));
        mvc.perform(get("/api/workloads")).andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(6)));

        String body = """
                {"name":"Tree test","description":"Parent order is resolved before loading.","processes":[
                  {"pid":62002,"name":"child","priority":4,"arrivalTime":0,"burstTime":2,"memoryRequirement":32,"parentPid":62001},
                  {"pid":62001,"name":"root","priority":6,"arrivalTime":0,"burstTime":3,"memoryRequirement":64,"parentPid":-1}],
                  "algorithm":"FCFS","timeQuantum":0,"preemptivePriority":false,"totalMemory":512,
                  "memoryAllocationStrategy":"FIRST_FIT","speed":1.0}
                """;
        mvc.perform(post("/api/workloads/validate").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        String cycle = body.replace("62001,\"name\":\"root\",\"priority\":6,\"arrivalTime\":0,\"burstTime\":3,\"memoryRequirement\":64,\"parentPid\":-1",
                "62001,\"name\":\"root\",\"priority\":6,\"arrivalTime\":0,\"burstTime\":3,\"memoryRequirement\":64,\"parentPid\":62002");
        mvc.perform(post("/api/workloads/validate").contentType(MediaType.APPLICATION_JSON).content(cycle))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));
        String duplicate = body.replace("62002,\"name\":\"child\"", "62001,\"name\":\"child\"");
        mvc.perform(post("/api/workloads/validate").contentType(MediaType.APPLICATION_JSON).content(duplicate))
                .andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));
        mvc.perform(post("/api/workloads").contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("\"burstTime\":2", "\"burstTime\":0")))
                .andExpect(status().isBadRequest());

        String created = mvc.perform(post("/api/workloads").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").isNotEmpty()).andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.JsonNode record = new com.fasterxml.jackson.databind.ObjectMapper().readTree(created);
        String id = record.get("id").asText();
        mvc.perform(get("/api/workloads")).andExpect(status().isOk()).andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(7)));
        mvc.perform(get("/api/workloads/{id}", id)).andExpect(status().isOk()).andExpect(jsonPath("$.processes", org.hamcrest.Matchers.hasSize(2)));
        mvc.perform(put("/api/workloads/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("Tree test", "Updated tree test")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated tree test"));
        mvc.perform(post("/api/workloads/{id}/load", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.processes", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$.processes[0].pid").value(62001));
        mvc.perform(get("/api/simulation/state")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("READY"));
        mvc.perform(delete("/api/processes/62001")).andExpect(status().isNoContent());
        mvc.perform(post("/api/workloads/{id}/execute", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.createdPids[0]").value(62001)).andExpect(jsonPath("$.createdPids[1]").value(62002))
                .andExpect(jsonPath("$.simulation.algorithm").value("FCFS"))
                .andExpect(jsonPath("$.simulation.status").value("RUNNING"));
        mvc.perform(get("/api/processes/tree")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pid").value(62001)).andExpect(jsonPath("$[0].children[0].pid").value(62002));
        mvc.perform(delete("/api/workloads/{id}", id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/workloads/{id}", id)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/workloads/builtin-short-jobs")).andExpect(status().isConflict());
        org.junit.jupiter.api.Assertions.assertTrue(Files.exists(DATA.resolve("workloads.json")));
    }

    private static Path tempDirectory() {
        try { return Files.createTempDirectory("kernelx-workloads-" + UUID.randomUUID()); }
        catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }
}
