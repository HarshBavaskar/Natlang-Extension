package com.natlangx.service;

import org.springframework.stereotype.Service;

import com.natlangx.agent.CodeAgent;
import com.natlangx.dto.AgentResponse;
import com.natlangx.dto.ProcessRequest;
import com.natlangx.model.Transpilation;

@Service
public class AgentService {
    private final CodeAgent codeAgent;
    private final PipelineService pipelineService;
    private final TranspilationService transpilationService;

    public AgentService(CodeAgent codeAgent, PipelineService pipelineService, TranspilationService transpilationService) {
        this.codeAgent = codeAgent;
        this.pipelineService = pipelineService;
        this.transpilationService = transpilationService;
    }

    public AgentResponse processAndPersist(ProcessRequest request) {
        String projectSuggestions = pipelineService.buildProjectWideSuggestions(request.getProjectContext());
        AgentResponse response = codeAgent.process(request, projectSuggestions);

        Transpilation transpilation = new Transpilation();
        transpilation.setUserId(request.getUserId());
        transpilation.setPrompt(request.getPrompt());
        transpilation.setGeneratedCode(response.getFinalCode());
        transpilation.setOptimizedCode(response.getOptimizedCode());
        transpilation.setExplanation(response.getExplanation());
        transpilation.setTimeComplexity(response.getTimeComplexity());
        transpilation.setSpaceComplexity(response.getSpaceComplexity());
        transpilation.setSuggestions(response.getSuggestions());
        transpilation.setTopic(response.getTopic());
        transpilation.setProvider(request.getProvider());
        transpilation.setLanguage(request.getLanguage());
        transpilation.setAgentSteps(String.join(",", response.getSteps()));
        transpilation.setDecisionLog(response.getDecisionLog());

        Transpilation created = transpilationService.create(transpilation);
        transpilationService.createActionRecord(created.getId(), request, response);
        if (created.getId() != null) {
            Transpilation persisted = transpilationService.getById(created.getId());
            if (persisted.getExplanation() != null && !persisted.getExplanation().isBlank()) {
                response.setExplanation(persisted.getExplanation());
            }
        }

        return response;
    }
}
