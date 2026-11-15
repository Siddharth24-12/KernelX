package com.kernelx.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class ComparisonApiIntegrationTest {
    private static final Path DATA = temporaryDirectory();
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> DATA.toString());
    }

    @Test void comparesFreshRunsPersistsReportsAndLeavesLiveRuntimeAndWorkloadUntouched() throws Exception {
        String workloadRequest = """
                {"name":"Arrival comparison","description":"Idle then two jobs","processes":[
                  {"pid":72001,"name":"long-low","priority":1,"arrivalTime":2,"burstTime":3,"memoryRequirement":32,"parentPid":-1},
                  {"pid":72002,"name":"short-high","priority":10,"arrivalTime":4,"burstTime":1,"memoryRequirement":32,"parentPid":-1}],
                  "algorithm":"FCFS","timeQuantum":0,"preemptivePriority":false,"totalMemory":512,
                  "memoryAllocationStrategy":"FIRST_FIT","speed":1.0}
                """;
        String workloadJson = mvc.perform(post("/api/workloads").contentType(MediaType.APPLICATION_JSON).content(workloadRequest))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String workloadId = mapper.readTree(workloadJson).get("id").asText();

        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":73001,\"name\":\"live-process\",\"priority\":5,\"arrivalTime\":0,\"burstTime\":10,\"memoryRequirement\":64}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/memory/allocate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":73001,\"strategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"FCFS\",\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":2}"))
                .andExpect(status().isOk());

        JsonNode workloadBefore = read(get("/api/workloads/{id}", workloadId));
        JsonNode liveStateBefore = read(get("/api/simulation/state"));
        JsonNode liveProcessesBefore = read(get("/api/processes"));
        JsonNode liveMemoryBefore = read(get("/api/memory"));
        JsonNode liveEventsBefore = read(get("/api/simulation/events"));
        JsonNode[] diagnosticCountsBefore = diagnosticCounts();

        String request = comparisonRequest(workloadId);
        String firstJson = mvc.perform(post("/api/comparisons").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.results", hasSize(6)))
                .andExpect(jsonPath("$.results[0].algorithm").value("FCFS"))
                .andExpect(jsonPath("$.results[0].gantt[0].idle").value(true))
                .andExpect(jsonPath("$.results[0].processes[1].waitingTime").value(1))
                .andExpect(jsonPath("$.results[2].algorithm").value("ROUND_ROBIN"))
                .andExpect(jsonPath("$.results[2].timeQuantum").value(2))
                .andExpect(jsonPath("$.results[3].timeQuantum").value(3))
                .andExpect(jsonPath("$.results[5].preemptive").value(true))
                .andExpect(jsonPath("$.results[0].totalTime").value(6))
                .andExpect(jsonPath("$.winners", hasSize(5)))
                .andReturn().getResponse().getContentAsString();
        JsonNode firstReport = mapper.readTree(firstJson);
        String reportId = firstReport.get("comparisonId").asText();
        assertEquals(66.66666666666667, firstReport.at("/results/0/cpuUtilization").asDouble(), 0.000001);
        assertEquals(2.0 / 6.0, firstReport.at("/results/0/throughput").asDouble(), 0.000001);
        JsonNode responseWinner = null;
        for (JsonNode winner : firstReport.get("winners")) {
            if ("averageResponseTime".equals(winner.path("metric").asText())) responseWinner = winner;
        }
        assertTrue(responseWinner != null, "response-time winner should be present");
        assertTrue(responseWinner.get("configurationIds").toString().contains("rr-1"));
        assertTrue(responseWinner.get("configurationIds").toString().contains("priority-p"));

        String secondJson = mvc.perform(post("/api/comparisons").contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertEquals(firstReport.get("results"), mapper.readTree(secondJson).get("results"), "identical inputs must produce identical results");

        assertEquals(workloadBefore, read(get("/api/workloads/{id}", workloadId)));
        assertEquals(liveStateBefore, read(get("/api/simulation/state")));
        assertEquals(liveProcessesBefore, read(get("/api/processes")));
        assertEquals(liveMemoryBefore, read(get("/api/memory")));
        assertEquals(liveEventsBefore, read(get("/api/simulation/events")));
        JsonNode[] diagnosticCountsAfter = diagnosticCounts();
        for (int index = 0; index < diagnosticCountsBefore.length; index++) assertEquals(diagnosticCountsBefore[index], diagnosticCountsAfter[index]);

        mvc.perform(get("/api/comparisons")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(get("/api/comparisons/{id}", reportId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.workloadSnapshot.name").value("Arrival comparison"));
        String invalid = "{\"workloadId\":\"" + workloadId + "\",\"configurations\":["
                + "{\"configurationId\":\"bad\",\"label\":\"bad quantum\",\"algorithm\":\"ROUND_ROBIN\",\"timeQuantum\":0},"
                + "{\"configurationId\":\"fcfs\",\"label\":\"FCFS\",\"algorithm\":\"FCFS\"}]}";
        mvc.perform(post("/api/comparisons").contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/comparisons")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(delete("/api/comparisons/{id}", reportId)).andExpect(status().isNoContent());
        mvc.perform(get("/api/comparisons/{id}", reportId)).andExpect(status().isNotFound());
        assertTrue(Files.exists(DATA.resolve("comparisons.json")));
    }

    private JsonNode read(org.springframework.test.web.servlet.RequestBuilder request) throws Exception {
        MvcResult result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode[] diagnosticCounts() throws Exception {
        return new JsonNode[]{read(get("/api/dsa/heap/runs")), read(get("/api/dsa/fpb/traces")),
                read(get("/api/dsa/pmu/traces")), read(get("/api/dsa/alu/traces")), read(get("/api/dsa/ptu/traces"))};
    }

    private String comparisonRequest(String workloadId) {
        return """
                {"workloadId":"%s","configurations":[
                  {"configurationId":"fcfs","label":"FCFS","algorithm":"FCFS"},
                  {"configurationId":"sjf","label":"SJF","algorithm":"SJF"},
                  {"configurationId":"rr-1","label":"Round Robin q2","algorithm":"ROUND_ROBIN","timeQuantum":2},
                  {"configurationId":"rr-2","label":"Round Robin q3","algorithm":"ROUND_ROBIN","timeQuantum":3},
                  {"configurationId":"priority-np","label":"Priority non-preemptive","algorithm":"PRIORITY"},
                  {"configurationId":"priority-p","label":"Priority preemptive","algorithm":"PRIORITY","preemptivePriority":true}
                ]}
                """.formatted(workloadId);
    }

    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("kernelx-comparisons-" + UUID.randomUUID()); }
        catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }
}
