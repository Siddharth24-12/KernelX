package com.kernelx.controller;

import com.kernelx.dto.SaveConfigurationRequest;
import com.kernelx.dto.SavedConfiguration;
import com.kernelx.service.ConfigurationStoreService;
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
@RequestMapping("/api/configurations")
public class ConfigurationController {
    private final ConfigurationStoreService configurations;
    public ConfigurationController(ConfigurationStoreService configurations) { this.configurations = configurations; }

    @PostMapping
    public ResponseEntity<SavedConfiguration> save(@Valid @RequestBody SaveConfigurationRequest request) {
        SavedConfiguration saved = configurations.save(request);
        return ResponseEntity.created(URI.create("/api/configurations/" + saved.id())).body(saved);
    }

    @GetMapping
    public List<SavedConfiguration> list() { return configurations.findAll(); }

    @GetMapping("/{id}")
    public SavedConfiguration get(@PathVariable String id) { return configurations.findById(id); }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        configurations.delete(id);
        return ResponseEntity.noContent().build();
    }
}
