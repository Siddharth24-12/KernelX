package com.kernelx.controller;

import com.kernelx.dto.SaveSimulationRequest;
import com.kernelx.dto.SavedSimulation;
import com.kernelx.service.SimulationArchiveService;
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
@RequestMapping("/api/simulations")
public class SavedSimulationController {
    private final SimulationArchiveService archives;
    public SavedSimulationController(SimulationArchiveService archives) { this.archives = archives; }

    @PostMapping("/save")
    public ResponseEntity<SavedSimulation> save(@Valid @RequestBody SaveSimulationRequest request) {
        SavedSimulation saved = archives.save(request.name());
        return ResponseEntity.created(URI.create("/api/simulations/" + saved.id())).body(saved);
    }

    @GetMapping
    public List<SavedSimulation> list() { return archives.findAll(); }

    @GetMapping("/{id}")
    public SavedSimulation get(@PathVariable String id) { return archives.findById(id); }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        archives.delete(id);
        return ResponseEntity.noContent().build();
    }
}
