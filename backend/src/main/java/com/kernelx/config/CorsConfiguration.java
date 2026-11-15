package com.kernelx.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class CorsConfiguration implements WebMvcConfigurer {
    private final List<String> configuredOrigins;

    public CorsConfiguration(@Value("${kernelx.cors.allowed-origins:}") String allowedOrigins) {
        this.configuredOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .collect(Collectors.toList());
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        var mapping = registry.addMapping("/api/**")
                // Spring's [*] port pattern accepts any port, while remaining limited to loopback hosts.
                .allowedOriginPatterns("http://localhost:[*]", "http://127.0.0.1:[*]")
                .allowedMethods("GET", "POST", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
        if (!configuredOrigins.isEmpty()) {
            mapping.allowedOrigins(configuredOrigins.toArray(String[]::new));
        }
    }
}
