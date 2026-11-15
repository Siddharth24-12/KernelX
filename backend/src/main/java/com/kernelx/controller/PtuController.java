package com.kernelx.controller;

import com.kernelx.dto.*;
import com.kernelx.service.SimulationRuntimeService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dsa/ptu")
public class PtuController {
    private final SimulationRuntimeService runtime;
    public PtuController(SimulationRuntimeService runtime) { this.runtime = runtime; }
    @GetMapping("/snapshot") public PtuSnapshot snapshot() { return runtime.ptuSnapshot(); }
    @GetMapping("/traces") public List<PtuTraceSummary> traces() { return runtime.ptuTraces(); }
    @GetMapping("/traces/{traceId}") public PtuTrace trace(@PathVariable String traceId) { return runtime.ptuTrace(traceId); }
}
