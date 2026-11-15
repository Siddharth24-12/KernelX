package com.kernelx.controller;

import com.kernelx.dto.AluTableSnapshot;
import com.kernelx.dto.AluTrace;
import com.kernelx.dto.AluTraceSummary;
import com.kernelx.service.SimulationRuntimeService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only diagnostics for the real PID associative lookup table. */
@RestController
@RequestMapping("/api/dsa/alu")
public class AluController {
    private final SimulationRuntimeService runtime;
    public AluController(SimulationRuntimeService runtime) { this.runtime = runtime; }
    @GetMapping("/snapshot") public AluTableSnapshot snapshot() { return runtime.aluSnapshot(); }
    @GetMapping("/traces") public List<AluTraceSummary> traces() { return runtime.aluTraces(); }
    @GetMapping("/traces/{traceId}") public AluTrace trace(@PathVariable String traceId) { return runtime.aluTrace(traceId); }
}
