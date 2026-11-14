package com.kernelx.controller;

import com.kernelx.dto.HeapRunSummary;
import com.kernelx.dto.HeapRunTrace;
import com.kernelx.service.HeapTraceRecorder;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dsa/heap/runs")
public class HeapTraceController {
    private final HeapTraceRecorder recorder;
    public HeapTraceController(HeapTraceRecorder recorder) { this.recorder = recorder; }

    @GetMapping
    public List<HeapRunSummary> list() { return recorder.listRuns(); }

    @GetMapping("/{runId}")
    public ResponseEntity<HeapRunTrace> get(@PathVariable String runId) {
        return recorder.getRun(runId).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}
