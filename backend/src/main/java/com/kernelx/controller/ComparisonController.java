package com.kernelx.controller;

import com.kernelx.dto.ComparisonReport;
import com.kernelx.dto.RunComparisonRequest;
import com.kernelx.service.ComparisonService;
import jakarta.validation.Valid;
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
@RequestMapping("/api/comparisons")
public class ComparisonController {
    private final ComparisonService comparisons;
    public ComparisonController(ComparisonService comparisons) { this.comparisons = comparisons; }

    @PostMapping
    public ResponseEntity<ComparisonReport> compare(@Valid @RequestBody RunComparisonRequest request) {
        ComparisonReport report = comparisons.compare(request);
        return ResponseEntity.created(URI.create("/api/comparisons/" + report.comparisonId())).body(report);
    }

    @GetMapping public List<ComparisonReport> list() { return comparisons.findAll(); }
    @GetMapping("/{id}") public ComparisonReport get(@PathVariable String id) { return comparisons.findById(id); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable String id) {
        comparisons.delete(id); return ResponseEntity.noContent().build();
    }
}
