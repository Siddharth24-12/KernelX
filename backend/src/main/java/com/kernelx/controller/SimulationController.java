package com.kernelx.controller;

import com.kernelx.dto.SchedulingMetricsResponse;
import com.kernelx.dto.SimulationStartRequest;
import com.kernelx.dto.StepRequest;
import com.kernelx.model.GanttSegment;
import com.kernelx.model.SchedulingResult;
import com.kernelx.model.SimulationSnapshot;
import com.kernelx.model.SystemEvent;
import com.kernelx.model.SystemEventType;
import com.kernelx.service.SimulationRuntimeService;
import com.kernelx.service.EventLogPersistenceService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {
    private final SimulationRuntimeService runtime;
    private final EventLogPersistenceService eventLog;
    public SimulationController(SimulationRuntimeService runtime, EventLogPersistenceService eventLog) {
        this.runtime = runtime;
        this.eventLog = eventLog;
    }

    @PostMapping("/start")
    public SimulationSnapshot start(@Valid @RequestBody SimulationStartRequest request) { return runtime.start(request); }

    @PostMapping("/pause")
    public SimulationSnapshot pause() { return runtime.pauseSimulation(); }

    @PostMapping("/resume")
    public SimulationSnapshot resume() { return runtime.resumeSimulation(); }

    @PostMapping("/step")
    public SimulationSnapshot step(@Valid @RequestBody(required = false) StepRequest request) {
        return runtime.step(request == null ? 1 : request.tickCount());
    }

    @PostMapping("/reset")
    public SimulationSnapshot reset() { return runtime.reset(); }

    @GetMapping("/state")
    public SimulationSnapshot state() { return runtime.state(); }

    @GetMapping("/scheduling")
    public SchedulingResult scheduling() { return runtime.scheduling(); }

    @GetMapping("/gantt")
    public List<GanttSegment> gantt() { return runtime.scheduling().gantt(); }

    @GetMapping("/metrics")
    public SchedulingMetricsResponse metrics() { return SchedulingMetricsResponse.from(runtime.scheduling()); }

    @GetMapping("/events")
    public List<SystemEvent> events(@RequestParam(required = false) Integer pid,
                                    @RequestParam(required = false) SystemEventType type) {
        return eventLog.findAll().stream()
                .filter(event -> pid == null || (event.pid() != null && event.pid().equals(pid)))
                .filter(event -> type == null || event.type() == type)
                .toList();
    }
}
