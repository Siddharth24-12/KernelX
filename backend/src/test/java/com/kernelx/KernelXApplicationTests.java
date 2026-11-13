package com.kernelx;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@SpringBootTest
@AutoConfigureMockMvc
class KernelXApplicationTests {
    private static final Path TEST_DATA = createTestDirectory();

    @Autowired private MockMvc mockMvc;

    @DynamicPropertySource
    static void dataDirectory(DynamicPropertyRegistry registry) {
        registry.add("kernelx.data-directory", () -> TEST_DATA.toString());
    }

    @Test void healthEndpointReportsBackendAvailability() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.application").value("KernelX"));
    }

    private static Path createTestDirectory() {
        try { return Files.createTempDirectory("kernelx-health-test-" + UUID.randomUUID()); }
        catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
    }
}
