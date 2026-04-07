package com.natlangx.service;

import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;

import com.natlangx.dao.TranspilationDAO;
import com.natlangx.dto.AgentResponse;
import com.natlangx.dto.ProcessRequest;
import com.natlangx.exception.ApiException;
import com.natlangx.model.Transpilation;

@Service
public class TranspilationService {
    private final TranspilationDAO transpilationDAO;

    public TranspilationService(TranspilationDAO transpilationDAO) {
        this.transpilationDAO = transpilationDAO;
    }

    public Transpilation create(Transpilation transpilation) {
        return transpilationDAO.create(transpilation);
    }

    public List<Transpilation> getAll() {
        return transpilationDAO.findAll();
    }

    public Transpilation getById(int id) {
        return transpilationDAO.findById(id).orElseThrow(() -> new ApiException("Transpilation not found"));
    }

    public Transpilation update(int id, Transpilation transpilation) {
        if (!transpilationDAO.update(id, transpilation)) {
            throw new ApiException("Transpilation update failed");
        }
        return getById(id);
    }

    public void delete(int id) {
        if (!transpilationDAO.delete(id)) {
            throw new ApiException("Transpilation delete failed");
        }
    }

    public List<Transpilation> search(String language, String topic, String complexity, String provider) {
        return transpilationDAO.search(language, topic, complexity, provider);
    }

    public void createActionRecord(Integer transpilationId, ProcessRequest request, AgentResponse response) {
        String action = request.getAction() == null ? "auto" : request.getAction().toLowerCase(Locale.ROOT);

        if ("summarize".equals(action)) {
            transpilationDAO.createSummaryRecord(
                    transpilationId,
                    request.getUserId(),
                    request.getPrompt(),
                    request.getCode(),
                    response.getExplanation(),
                    response.getTopic(),
                    request.getProvider(),
                    request.getLanguage(),
                    response.getDecisionLog()
            );
            return;
        }

        if ("better".equals(action)) {
            transpilationDAO.createBetterCodeRecord(
                    transpilationId,
                    request.getUserId(),
                    request.getPrompt(),
                    request.getCode(),
                    response.getExplanation(),
                    response.getTimeComplexity(),
                    response.getSpaceComplexity(),
                    response.getTopic(),
                    request.getProvider(),
                    request.getLanguage(),
                    response.getDecisionLog()
            );
            return;
        }

        transpilationDAO.createOptimizationRun(
                transpilationId,
                request.getUserId(),
                request.getPrompt(),
                request.getCode(),
                response.getOptimizedCode(),
                response.getTimeComplexity(),
                response.getSpaceComplexity(),
                response.getTopic(),
                request.getProvider(),
                request.getLanguage(),
                response.getDecisionLog()
        );
    }
}
