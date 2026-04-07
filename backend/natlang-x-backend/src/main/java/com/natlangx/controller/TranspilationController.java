package com.natlangx.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.natlangx.dto.AgentResponse;
import com.natlangx.dto.ProcessRequest;
import com.natlangx.dto.ProviderHealthStatus;
import com.natlangx.dto.ProviderRuntimeStatus;
import com.natlangx.model.Transpilation;
import com.natlangx.provider.AIProvider;
import com.natlangx.service.AgentService;
import com.natlangx.service.TranspilationService;

import jakarta.validation.Valid;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api")
public class TranspilationController {
    private final AgentService agentService;
    private final TranspilationService transpilationService;
    private final List<AIProvider> providers;

    public TranspilationController(AgentService agentService, TranspilationService transpilationService, List<AIProvider> providers) {
        this.agentService = agentService;
        this.transpilationService = transpilationService;
        this.providers = providers;
    }

    @PostMapping("/process")
    public ResponseEntity<AgentResponse> process(@Valid @RequestBody ProcessRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(agentService.processAndPersist(request));
    }

    @GetMapping("/providers/health")
    public ResponseEntity<List<ProviderHealthStatus>> providersHealth() {
        List<ProviderHealthStatus> result = providers.stream()
                .map(AIProvider::health)
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/providers/runtime")
    public ResponseEntity<List<ProviderRuntimeStatus>> providersRuntime() {
        List<ProviderRuntimeStatus> result = providers.stream()
                .map(provider -> {
                    ProviderHealthStatus health = provider.health();
                    return new ProviderRuntimeStatus(
                            provider.providerName(),
                            provider.modelName(),
                            health.isConfigured(),
                            health.isReachable(),
                            health.getDetail()
                    );
                })
                .toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/history")
    public ResponseEntity<List<Transpilation>> history() {
        return ResponseEntity.ok(transpilationService.getAll());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFromHistory(@PathVariable int id) {
        transpilationService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search")
    public ResponseEntity<List<Transpilation>> search(
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String complexity,
            @RequestParam(required = false) String provider) {
        return ResponseEntity.ok(transpilationService.search(language, topic, complexity, provider));
    }

    @PostMapping("/transpilations")
    public ResponseEntity<Transpilation> createTranspilation(@RequestBody Transpilation transpilation) {
        return ResponseEntity.status(HttpStatus.CREATED).body(transpilationService.create(transpilation));
    }

    @GetMapping("/transpilations")
    public ResponseEntity<List<Transpilation>> getTranspilations() {
        return ResponseEntity.ok(transpilationService.getAll());
    }

    @GetMapping("/transpilations/{id}")
    public ResponseEntity<Transpilation> getTranspilation(@PathVariable int id) {
        return ResponseEntity.ok(transpilationService.getById(id));
    }

    @PutMapping("/transpilations/{id}")
    public ResponseEntity<Transpilation> updateTranspilation(@PathVariable int id, @RequestBody Transpilation transpilation) {
        return ResponseEntity.ok(transpilationService.update(id, transpilation));
    }

    @DeleteMapping("/transpilations/{id}")
    public ResponseEntity<Void> deleteTranspilation(@PathVariable int id) {
        transpilationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
