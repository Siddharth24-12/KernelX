package com.kernelx.controller;

import com.kernelx.dto.FpbLiveSnapshot;
import com.kernelx.dto.FpbTrace;
import com.kernelx.dto.FpbTraceSummary;
import com.kernelx.service.SimulationRuntimeService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only API for actual historical FCFS and Round Robin queue operations. */
@RestController
@RequestMapping("/api/dsa/fpb")
public class FpbController {
    private final SimulationRuntimeService runtime;
    public FpbController(SimulationRuntimeService runtime) { this.runtime = runtime; }
    @GetMapping("/snapshot") public FpbLiveSnapshot snapshot() { return runtime.fpbSnapshot(); }
    @GetMapping("/traces") public List<FpbTraceSummary> traces() { return runtime.fpbTraces(); }
    @GetMapping("/traces/{traceId}") public FpbTrace trace(@PathVariable String traceId) { return runtime.fpbTrace(traceId); }
}
