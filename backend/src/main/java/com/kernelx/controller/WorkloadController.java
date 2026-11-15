package com.kernelx.controller;

import com.kernelx.dto.WorkloadDefinition;
import com.kernelx.dto.WorkloadExecutionResponse;
import com.kernelx.dto.WorkloadRequest;
import com.kernelx.dto.WorkloadValidationResponse;
import com.kernelx.service.WorkloadService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workloads")
public class WorkloadController {
    private final WorkloadService workloads;
    public WorkloadController(WorkloadService workloads) { this.workloads = workloads; }

    @GetMapping public List<WorkloadDefinition> list() { return workloads.findAll(); }
    @GetMapping("/templates") public List<WorkloadDefinition> templates() { return workloads.templates(); }
    @GetMapping("/{id}") public WorkloadDefinition get(@PathVariable String id) { return workloads.findById(id); }

    @PostMapping
    public ResponseEntity<WorkloadDefinition> create(@Valid @RequestBody WorkloadRequest request) {
        WorkloadDefinition created = workloads.create(request);
        return ResponseEntity.created(URI.create("/api/workloads/" + created.id())).body(created);
    }

    @PutMapping("/{id}") public WorkloadDefinition update(@PathVariable String id, @Valid @RequestBody WorkloadRequest request) {
        return workloads.update(id, request);
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id) {
        workloads.delete(id); return ResponseEntity.noContent().build();
    }
    @PostMapping("/validate") public WorkloadValidationResponse validate(@Valid @RequestBody WorkloadRequest request) {
        return workloads.validate(request);
    }
    @PostMapping("/{id}/load") public com.kernelx.dto.WorkloadLoadResponse load(@PathVariable String id) {
        return workloads.load(id);
    }
    @PostMapping("/{id}/execute") public WorkloadExecutionResponse execute(@PathVariable String id) {
        return workloads.execute(id);
    }
}
