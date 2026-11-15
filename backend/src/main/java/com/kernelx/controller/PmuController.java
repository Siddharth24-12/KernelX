package com.kernelx.controller;

import com.kernelx.dto.PmuListSnapshot;
import com.kernelx.dto.PmuTrace;
import com.kernelx.dto.PmuTraceSummary;
import com.kernelx.service.SimulationRuntimeService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only diagnostic API for the ProcessManager's actual custom linked list. */
@RestController
@RequestMapping("/api/dsa/pmu")
public class PmuController {
    private final SimulationRuntimeService runtime;

    public PmuController(SimulationRuntimeService runtime) { this.runtime = runtime; }

    @GetMapping("/snapshot")
    public PmuListSnapshot snapshot() { return runtime.processListSnapshot(); }

    @GetMapping("/traces")
    public List<PmuTraceSummary> traces() { return runtime.processListTraces(); }

    @GetMapping("/traces/{traceId}")
    public PmuTrace trace(@PathVariable String traceId) { return runtime.processListTrace(traceId); }
}
