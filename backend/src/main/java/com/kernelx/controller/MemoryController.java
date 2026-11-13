package com.kernelx.controller;

import com.kernelx.dto.MemoryAllocationRequest;
import com.kernelx.dto.MemoryDeallocationRequest;
import com.kernelx.dto.MemoryOperationResponse;
import com.kernelx.model.MemorySnapshot;
import com.kernelx.service.SimulationRuntimeService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/memory")
public class MemoryController {
    private final SimulationRuntimeService runtime;
    public MemoryController(SimulationRuntimeService runtime) { this.runtime = runtime; }

    @GetMapping
    public MemorySnapshot get() { return runtime.memory(); }

    @PostMapping("/allocate")
    public MemoryOperationResponse allocate(@Valid @RequestBody MemoryAllocationRequest request) {
        return new MemoryOperationResponse(true, runtime.allocateMemory(request.pid(), request.strategy()));
    }

    @PostMapping("/deallocate")
    public MemoryOperationResponse deallocate(@Valid @RequestBody MemoryDeallocationRequest request) {
        return new MemoryOperationResponse(true, runtime.deallocateMemory(request.pid()));
    }
}
