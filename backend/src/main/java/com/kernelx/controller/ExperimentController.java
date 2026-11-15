package com.kernelx.controller;

import com.kernelx.dto.ExperimentReport;
import com.kernelx.dto.ExperimentRequest;
import com.kernelx.service.ExperimentService;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/experiments")
public class ExperimentController {
    private final ExperimentService experiments;
    public ExperimentController(ExperimentService experiments) { this.experiments = experiments; }

    @PostMapping
    public ResponseEntity<ExperimentReport> execute(@RequestBody ExperimentRequest request) {
        ExperimentReport report = experiments.execute(request);
        return ResponseEntity.created(URI.create("/api/experiments/" + report.experimentId())).body(report);
    }
    @GetMapping public List<ExperimentReport> list() { return experiments.findAll(); }
    @GetMapping("/{id}") public ExperimentReport get(@PathVariable String id) { return experiments.findById(id); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id) {
        experiments.delete(id); return ResponseEntity.noContent().build();
    }
}
