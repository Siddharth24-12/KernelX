package com.kernelx.controller;

import com.kernelx.dto.ChangePriorityRequest;
import com.kernelx.dto.CreateProcessRequest;
import com.kernelx.dto.ProcessResponse;
import com.kernelx.dto.ProcessTreeNodeResponse;
import com.kernelx.model.ProcessControlBlock;
import com.kernelx.dsa.ProcessTree;
import com.kernelx.service.SimulationRuntimeService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/processes")
public class ProcessController {
    private final SimulationRuntimeService runtime;
    public ProcessController(SimulationRuntimeService runtime) { this.runtime = runtime; }

    @PostMapping
    public ResponseEntity<ProcessResponse> create(@Valid @RequestBody CreateProcessRequest request) {
        ProcessResponse created = runtime.createProcess(request);
        return ResponseEntity.created(URI.create("/api/processes/" + created.pid())).body(created);
    }

    @GetMapping
    public List<ProcessResponse> list() { return runtime.listProcesses(); }

    @GetMapping("/tree")
    public List<ProcessTreeNodeResponse> tree() {
        return runtime.processTreeSnapshot().stream().map(ProcessController::treeNode).toList();
    }

    private static ProcessTreeNodeResponse treeNode(ProcessTree.SnapshotNode node) {
        ProcessControlBlock process = node.process();
        return new ProcessTreeNodeResponse(process.getPid(), process.getName(), process.getState(),
                process.getPriority(), process.getParentPid(), process.getArrivalTime(), process.getBurstTime(),
                process.getRemainingTime(), process.getMemoryRequirement(), node.children().stream()
                .map(ProcessController::treeNode).toList());
    }

    @GetMapping("/{pid}")
    public ProcessResponse get(@PathVariable int pid) { return runtime.getProcess(pid); }

    @DeleteMapping("/{pid}")
    public ResponseEntity<Void> delete(@PathVariable int pid) {
        runtime.deleteProcess(pid);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{pid}/priority")
    public ProcessResponse priority(@PathVariable int pid, @Valid @RequestBody ChangePriorityRequest request) {
        return runtime.changePriority(pid, request.priority());
    }

    @PostMapping("/{pid}/pause")
    public ProcessResponse pause(@PathVariable int pid) { return runtime.pauseProcess(pid); }

    @PostMapping("/{pid}/resume")
    public ProcessResponse resume(@PathVariable int pid) { return runtime.resumeProcess(pid); }
}
