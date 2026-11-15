package com.kernelx.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertEquals;

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
class AnalyticsApiIntegrationTest {
    private static final Path DATA = temporaryDirectory();
    @Autowired private MockMvc mvc;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> DATA.toString());
    }

    @Test void reportsActualTicksMemoryFailuresAndReadOnlySnapshots() throws Exception {
        mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":91001,\"name\":\"analytics-worker\",\"priority\":5,\"arrivalTime\":1,\"burstTime\":2,\"memoryRequirement\":2048}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/memory/allocate").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pid\":91001,\"strategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/simulation/start").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"algorithm\":\"FCFS\",\"memoryAllocationStrategy\":\"FIRST_FIT\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/simulation/step").contentType(MediaType.APPLICATION_JSON).content("{\"ticks\":2}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/analytics/snapshot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpu.samples.length()").value(2))
                .andExpect(jsonPath("$.cpu.samples[0].cumulativeIdleTicks").value(1))
                .andExpect(jsonPath("$.cpu.samples[0].utilizationPercent").value(0.0))
                .andExpect(jsonPath("$.cpu.samples[1].runningPid").value(91001))
                .andExpect(jsonPath("$.cpu.observedBusyTicks").value(1))
                .andExpect(jsonPath("$.cpu.observedIdleTicks").value(1))
                .andExpect(jsonPath("$.cpu.observedUtilizationPercent").value(50.0))
                .andExpect(jsonPath("$.memory.allocationFailures").value(1))
                .andExpect(jsonPath("$.processes.stateCounts.RUNNING").value(1));
        String pmuTracesBefore = mvc.perform(get("/api/dsa/pmu/traces")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String aluTracesBefore = mvc.perform(get("/api/dsa/alu/traces")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/analytics/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.cpu.samples.length()").value(2));
        mvc.perform(get("/api/analytics/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.cpu.samples.length()").value(2));
        MvcResult pmuAfter = mvc.perform(get("/api/dsa/pmu/traces")).andExpect(status().isOk()).andReturn();
        MvcResult aluAfter = mvc.perform(get("/api/dsa/alu/traces")).andExpect(status().isOk()).andReturn();
        assertEquals(pmuTracesBefore, pmuAfter.getResponse().getContentAsString());
        assertEquals(aluTracesBefore, aluAfter.getResponse().getContentAsString());
    }

    private static Path temporaryDirectory() {
        try { return Files.createTempDirectory("kernelx-analytics-" + UUID.randomUUID()); }
        catch (java.io.IOException exception) { throw new IllegalStateException(exception); }
    }
}
