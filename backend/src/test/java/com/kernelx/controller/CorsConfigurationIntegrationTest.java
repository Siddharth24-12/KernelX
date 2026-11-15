package com.kernelx.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "kernelx.cors.allowed-origins=https://dashboard.kernelx.example")
@AutoConfigureMockMvc
class CorsConfigurationIntegrationTest {
    @Autowired private MockMvc mvc;

    @Test
    void allowsViteDevelopmentOriginsAndPreflightRequests() throws Exception {
        assertPreflightAllowed("http://localhost:5173");
        assertPreflightAllowed("http://localhost:5174");
        assertPreflightAllowed("http://127.0.0.1:5173");
        assertPreflightAllowed("https://dashboard.kernelx.example");
    }

    @Test
    void rejectsUnrelatedOrigins() throws Exception {
        mvc.perform(options("/api/health")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    private void assertPreflightAllowed(String origin) throws Exception {
        mvc.perform(options("/api/health")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin))
                .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"))
                .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("GET")));
    }
}
