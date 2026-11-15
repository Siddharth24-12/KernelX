package com.kernelx.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class ExperimentApiIntegrationTest {
    private static final Path DATA = temporaryDirectory();
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> DATA.toString());
    }

    @Test void isolatedSchedulingAndMemoryExperimentsPreserveInputsAndPersistOnlyCompletedReports() throws Exception {
        String workloadBody = """
                {"name":"Experiment base","description":"two jobs","processes":[
                  {"pid":85001,"name":"alpha","priority":3,"arrivalTime":0,"burstTime":4,"memoryRequirement":16,"parentPid":-1},
                  {"pid":85002,"name":"beta","priority":8,"arrivalTime":1,"burstTime":2,"memoryRequirement":16,"parentPid":-1}],
                  "algorithm":"FCFS","timeQuantum":0,"preemptivePriority":false,"totalMemory":120,
                  "memoryAllocationStrategy":"FIRST_FIT","speed":1.0}
                """;
        JsonNode workload = mapper.readTree(mvc.perform(post("/api/workloads").contentType(MediaType.APPLICATION_JSON).content(workloadBody))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String workloadId = workload.get("id").asText();

        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pid\":86001,\"name\":\"live\",\"priority\":5,\"arrivalTime\":0,\"burstTime\":9,\"memoryRequirement\":24}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/memory/allocate").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pid\":86001,\"strategy\":\"FIRST_FIT\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                .content("{\"algorithm\":\"FCFS\",\"memoryAllocationStrategy\":\"FIRST_FIT\"}")).andExpect(status().isOk());

        JsonNode workloadBefore = getJson(get("/api/workloads/{id}", workloadId));
        JsonNode stateBefore = getJson(get("/api/simulation/state"));
        JsonNode processesBefore = getJson(get("/api/processes"));
        JsonNode memoryBefore = getJson(get("/api/memory"));
        JsonNode eventsBefore = getJson(get("/api/simulation/events"));
        JsonNode[] tracesBefore = traceLists();

        String scheduleRequest = """
                {"name":"Arrival and algorithm","description":"Change scheduler and two process parameters","baseWorkloadId":"%s","type":"SCHEDULING","variants":[
                  {"variantId":"rr","label":"RR changed","algorithm":"ROUND_ROBIN","timeQuantum":2,"processChanges":[{"pid":85001,"burstTime":3},{"pid":85002,"arrivalTime":3,"priority":10}]},
                  {"variantId":"priority","label":"Priority preemptive","algorithm":"PRIORITY","preemptivePriority":true}]}
                """.formatted(workloadId);
        JsonNode first = mapper.readTree(mvc.perform(post("/api/experiments").contentType(MediaType.APPLICATION_JSON).content(scheduleRequest))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("SCHEDULING"))
                .andExpect(jsonPath("$.baseline.schedulingResult.algorithm").value("FCFS"))
                .andExpect(jsonPath("$.variants", hasSize(2))).andExpect(jsonPath("$.variants[0].schedulingResult.timeQuantum").value(2))
                .andExpect(jsonPath("$.processMetricDeltas", org.hamcrest.Matchers.not(hasSize(0))))
                .andExpect(jsonPath("$.winners", hasSize(5))).andReturn().getResponse().getContentAsString());
        JsonNode second = mapper.readTree(mvc.perform(post("/api/experiments").contentType(MediaType.APPLICATION_JSON).content(scheduleRequest))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertEquals(first.get("baseline").get("schedulingResult"), second.get("baseline").get("schedulingResult"));
        assertEquals(first.get("variants"), second.get("variants"), "same experiment inputs must produce deterministic run results");

        String memoryRequest = """
                {"name":"Fit strategy","description":"Same ordered request sequence","baseWorkloadId":"%s","type":"MEMORY","variants":[
                  {"variantId":"best","label":"Best Fit","memoryStrategy":"BEST_FIT"},
                  {"variantId":"worst","label":"Worst Fit","memoryStrategy":"WORST_FIT"}],"memoryOperations":[
                  {"operation":"ALLOCATE","pid":1,"amount":10},{"operation":"ALLOCATE","pid":2,"amount":20},
                  {"operation":"ALLOCATE","pid":3,"amount":30},{"operation":"ALLOCATE","pid":4,"amount":20},
                  {"operation":"ALLOCATE","pid":5,"amount":40},{"operation":"DEALLOCATE","pid":1},
                  {"operation":"DEALLOCATE","pid":3},{"operation":"ALLOCATE","pid":6,"amount":8}]}
                """.formatted(workloadId);
        JsonNode memoryReport = mapper.readTree(mvc.perform(post("/api/experiments").contentType(MediaType.APPLICATION_JSON).content(memoryRequest))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("MEMORY"))
                .andExpect(jsonPath("$.baseline.configuration.memoryStrategy").value("FIRST_FIT"))
                .andExpect(jsonPath("$.baseline.memoryResult.successfulAllocations").value(6))
                .andExpect(jsonPath("$.baseline.memoryResult.operations", hasSize(8)))
                .andExpect(jsonPath("$.variants", hasSize(2))).andExpect(jsonPath("$.winners", hasSize(6)))
                .andReturn().getResponse().getContentAsString());
        assertEquals(memoryReport.get("baseline").get("memoryResult").get("operations"),
                memoryReport.get("variants").get(0).get("memoryResult").get("operations"));
        assertEquals(memoryReport.get("baseline").get("memoryResult").get("operations"),
                memoryReport.get("variants").get(1).get("memoryResult").get("operations"));

        assertEquals(workloadBefore, getJson(get("/api/workloads/{id}", workloadId)));
        assertEquals(stateBefore, getJson(get("/api/simulation/state")));
        assertEquals(processesBefore, getJson(get("/api/processes")));
        assertEquals(memoryBefore, getJson(get("/api/memory")));
        assertEquals(eventsBefore, getJson(get("/api/simulation/events")));
        JsonNode[] tracesAfter = traceLists();
        for (int i = 0; i < tracesBefore.length; i++) assertEquals(tracesBefore[i], tracesAfter[i]);

        String reportId = memoryReport.get("experimentId").asText();
        mvc.perform(get("/api/experiments")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(3)));
        mvc.perform(get("/api/experiments/{id}", reportId)).andExpect(status().isOk()).andExpect(jsonPath("$.workloadSnapshot.name").value("Experiment base"));
        mvc.perform(post("/api/experiments").contentType(MediaType.APPLICATION_JSON).content(memoryRequest.replace("\"WORST_FIT\"", "\"FIRST_FIT\"")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/experiments")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(3)));
        mvc.perform(delete("/api/experiments/{id}", reportId)).andExpect(status().isNoContent());
        mvc.perform(get("/api/experiments/{id}", reportId)).andExpect(status().isNotFound());
        assertEquals(2, mapper.readTree(Files.readString(DATA.resolve("experiments.json"))).size());
    }

    private JsonNode getJson(MockHttpServletRequestBuilder request) throws Exception {
        return mapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode[] traceLists() throws Exception {
        return new JsonNode[]{getJson(get("/api/dsa/heap/runs")), getJson(get("/api/dsa/fpb/traces")),
                getJson(get("/api/dsa/pmu/traces")), getJson(get("/api/dsa/alu/traces")), getJson(get("/api/dsa/ptu/traces"))};
    }

    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("kernelx-experiments-" + UUID.randomUUID()); }
        catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }
}
