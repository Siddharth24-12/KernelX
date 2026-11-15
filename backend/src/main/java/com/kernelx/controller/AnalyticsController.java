package com.kernelx.controller;

import com.kernelx.dto.AnalyticsSnapshot;
import com.kernelx.service.AnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
    private final AnalyticsService analytics;
    public AnalyticsController(AnalyticsService analytics) { this.analytics = analytics; }

    @GetMapping("/snapshot")
    public AnalyticsSnapshot snapshot() { return analytics.snapshot(); }
}
