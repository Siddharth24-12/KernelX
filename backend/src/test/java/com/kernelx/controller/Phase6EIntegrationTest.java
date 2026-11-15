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
import com.kernelx.dto.ComparisonReport;
import com.kernelx.dto.ExperimentReport;
import com.kernelx.persistence.JsonFileRepository;
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

/** One isolated API path through workload, runtime, DSA, archive, comparison and experiment APIs. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase6EIntegrationTest {
    private static final Path DATA = temporaryDirectory();
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper mapper;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> DATA.toString());
    }

    @Test void fullWorkloadRuntimeAndReportWorkflowPreservesLiveAndHistoricalData() throws Exception {
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":90000,\"name\":\"temporary\",\"priority\":2,\"arrivalTime\":0,\"burstTime\":1,\"memoryRequirement\":8}"))
                .andExpect(status().isCreated());
        mvc.perform(delete("/api/processes/90000")).andExpect(status().isNoContent());
        mvc.perform(get("/api/processes/90000")).andExpect(status().isNotFound());

        String workloadBody = """
                {"name":"Phase 6E path","description":"Root and child workload","processes":[
                  {"pid":91002,"name":"child","priority":8,"arrivalTime":1,"burstTime":2,"memoryRequirement":48,"parentPid":91001},
                  {"pid":91001,"name":"root","priority":3,"arrivalTime":0,"burstTime":3,"memoryRequirement":64,"parentPid":-1}],
                  "algorithm":"SJF","timeQuantum":0,"preemptivePriority":false,"totalMemory":256,
                  "memoryAllocationStrategy":"BEST_FIT","speed":1.0}
                """;
        JsonNode workload = mapper.readTree(mvc.perform(post("/api/workloads").contentType(MediaType.APPLICATION_JSON).content(workloadBody))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String workloadId = workload.get("id").asText();
        JsonNode workloadBefore = json(get("/api/workloads/{id}", workloadId));

        mvc.perform(post("/api/workloads/{id}/load", workloadId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.processes", hasSize(2)));
        mvc.perform(get("/api/processes/tree")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pid").value(91001)).andExpect(jsonPath("$[0].children[0].pid").value(91002));
        mvc.perform(post("/api/memory/allocate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":91001,\"strategy\":\"BEST_FIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.memory.allocatedMemory").value(64));
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"SJF\",\"memoryAllocationStrategy\":\"BEST_FIT\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RUNNING"));

        mvc.perform(get("/api/simulation/scheduling")).andExpect(status().isOk())
                .andExpect(jsonPath("$.algorithm").value("SJF")).andExpect(jsonPath("$.processes", hasSize(2)));
        mvc.perform(get("/api/simulation/gantt")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(get("/api/simulation/metrics")).andExpect(status().isOk()).andExpect(jsonPath("$.averageWaitingTime").exists());
        mvc.perform(get("/api/dsa/heap/runs")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/dsa/pmu/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(2));
        mvc.perform(get("/api/dsa/alu/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(2));
        mvc.perform(get("/api/dsa/ptu/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(2));
        JsonNode[] diagnosticsBefore = diagnosticLists();
        String heapRunId = json(get("/api/dsa/heap/runs")).get(0).get("runId").asText();
        String pmuTraceId = json(get("/api/dsa/pmu/traces")).get(0).get("traceId").asText();
        String aluTraceId = json(get("/api/dsa/alu/traces")).get(0).get("traceId").asText();
        String ptuTraceId = json(get("/api/dsa/ptu/traces")).get(0).get("traceId").asText();
        mvc.perform(get("/api/dsa/heap/runs/{id}", heapRunId)).andExpect(status().isOk());
        mvc.perform(get("/api/dsa/pmu/traces/{id}", pmuTraceId)).andExpect(status().isOk());
        mvc.perform(get("/api/dsa/alu/traces/{id}", aluTraceId)).andExpect(status().isOk());
        mvc.perform(get("/api/dsa/ptu/traces/{id}", ptuTraceId)).andExpect(status().isOk());
        diagnosticLists(); diagnosticLists();
        JsonNode[] diagnosticsAfter = diagnosticLists();
        for (int i = 0; i < diagnosticsBefore.length; i++) assertEquals(diagnosticsBefore[i], diagnosticsAfter[i]);

        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":100}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        String savedJson = mvc.perform(post("/api/simulations/save").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Phase 6E snapshot\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String savedId = mapper.readTree(savedJson).get("id").asText();
        mvc.perform(get("/api/simulations/{id}", savedId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.processes", hasSize(2)));

        JsonNode stateBefore = json(get("/api/simulation/state"));
        JsonNode processesBefore = json(get("/api/processes"));
        JsonNode memoryBefore = json(get("/api/memory"));
        JsonNode eventsBefore = json(get("/api/simulation/events"));
        JsonNode[] traceListsBefore = diagnosticLists();
        String comparisonRequest = """
                {"workloadId":"%s","configurations":[
                  {"configurationId":"fcfs","label":"FCFS","algorithm":"FCFS"},
                  {"configurationId":"priority","label":"Priority","algorithm":"PRIORITY"}]}
                """.formatted(workloadId);
        JsonNode comparisonOne = mapper.readTree(mvc.perform(post("/api/comparisons").contentType(MediaType.APPLICATION_JSON).content(comparisonRequest))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.results", hasSize(2))).andReturn().getResponse().getContentAsString());
        JsonNode comparisonTwo = mapper.readTree(mvc.perform(post("/api/comparisons").contentType(MediaType.APPLICATION_JSON).content(comparisonRequest))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/analytics/snapshot")).andExpect(status().isOk());

        String schedulingExperiment = """
                {"name":"SJF parameter check","description":"RR variant","baseWorkloadId":"%s","type":"SCHEDULING","variants":[
                  {"variantId":"rr","label":"RR q2","algorithm":"ROUND_ROBIN","timeQuantum":2,"processChanges":[{"pid":91002,"burstTime":3}]}]}
                """.formatted(workloadId);
        JsonNode schedulingReport = mapper.readTree(mvc.perform(post("/api/experiments").contentType(MediaType.APPLICATION_JSON).content(schedulingExperiment))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.baseline.schedulingResult.algorithm").value("SJF"))
                .andExpect(jsonPath("$.variants[0].schedulingResult.timeQuantum").value(2)).andReturn().getResponse().getContentAsString());
        String memoryExperiment = """
                {"name":"Fit check","description":"shared sequence","baseWorkloadId":"%s","type":"MEMORY","variants":[
                  {"variantId":"best","label":"Best Fit","memoryStrategy":"BEST_FIT"},
                  {"variantId":"worst","label":"Worst Fit","memoryStrategy":"WORST_FIT"}],"memoryOperations":[
                  {"operation":"ALLOCATE","pid":1,"amount":64},{"operation":"DEALLOCATE","pid":1},{"operation":"ALLOCATE","pid":2,"amount":48}]}
                """.formatted(workloadId);
        JsonNode memoryReport = mapper.readTree(mvc.perform(post("/api/experiments").contentType(MediaType.APPLICATION_JSON).content(memoryExperiment))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.variants", hasSize(2))).andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/comparisons/{id}", comparisonOne.get("comparisonId").asText())).andExpect(status().isOk());
        mvc.perform(get("/api/experiments/{id}", schedulingReport.get("experimentId").asText())).andExpect(status().isOk());
        mvc.perform(get("/api/experiments/{id}", memoryReport.get("experimentId").asText())).andExpect(status().isOk());

        assertEquals(workloadBefore, json(get("/api/workloads/{id}", workloadId)));
        assertEquals(stateBefore, json(get("/api/simulation/state")));
        assertEquals(processesBefore, json(get("/api/processes")));
        assertEquals(memoryBefore, json(get("/api/memory")));
        assertEquals(eventsBefore, json(get("/api/simulation/events")));
        JsonNode[] traceListsAfter = diagnosticLists();
        for (int i = 0; i < traceListsBefore.length; i++) assertEquals(traceListsBefore[i], traceListsAfter[i]);

        mvc.perform(delete("/api/comparisons/{id}", comparisonOne.get("comparisonId").asText())).andExpect(status().isNoContent());
        mvc.perform(get("/api/comparisons")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/comparisons/{id}", comparisonTwo.get("comparisonId").asText())).andExpect(status().isOk());
        mvc.perform(delete("/api/experiments/{id}", schedulingReport.get("experimentId").asText())).andExpect(status().isNoContent());
        mvc.perform(get("/api/experiments")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/experiments/{id}", memoryReport.get("experimentId").asText())).andExpect(status().isOk());

        // Constructing a fresh repository against the same directory models JSON reload after process restart.
        assertEquals(1, new JsonFileRepository<>(DATA.resolve("experiments.json"), ExperimentReport.class, mapper).findAll().size());
        assertEquals(1, new JsonFileRepository<>(DATA.resolve("comparisons.json"), ComparisonReport.class, mapper).findAll().size());

        mvc.perform(post("/api/simulation/reset")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY")).andExpect(jsonPath("$.currentTime").value(0));
        mvc.perform(get("/api/processes")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].state").value("NEW"));
        mvc.perform(get("/api/memory")).andExpect(status().isOk()).andExpect(jsonPath("$.allocatedMemory").value(0));
        mvc.perform(get("/api/simulation/events")).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.type == 'SIMULATION_RESET')]", hasSize(1)));
        mvc.perform(get("/api/simulations/{id}", savedId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.scheduling.algorithm").value("SJF"));

        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"ROUND_ROBIN\",\"timeQuantum\":2,\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":100}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        JsonNode fpbTracesBeforeReads = json(get("/api/dsa/fpb/traces"));
        mvc.perform(get("/api/dsa/fpb/traces")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        String fpbTraceId = fpbTracesBeforeReads.get(0).get("traceId").asText();
        mvc.perform(get("/api/dsa/fpb/traces/{id}", fpbTraceId)).andExpect(status().isOk());
        assertEquals(fpbTracesBeforeReads, json(get("/api/dsa/fpb/traces")), "FPB diagnostic reads must not add operations");
        mvc.perform(post("/api/simulation/reset")).andExpect(status().isOk());
        assertTrue(Files.size(DATA.resolve("event_logs.json")) > 2, "historical event JSON remains after runtime reset");
    }

    private JsonNode json(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        return mapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode[] diagnosticLists() throws Exception {
        return new JsonNode[]{json(get("/api/dsa/heap/runs")), json(get("/api/dsa/pmu/traces")), json(get("/api/dsa/alu/traces")),
                json(get("/api/dsa/fpb/traces")), json(get("/api/dsa/ptu/traces"))};
    }

    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("kernelx-phase6e-" + UUID.randomUUID()); }
        catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }
}
