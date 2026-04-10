package com.natlangx.agent;

import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

import com.natlangx.analyzer.AnalysisResult;
import com.natlangx.analyzer.ComplexityAnalyzer;
import com.natlangx.dto.AgentResponse;
import com.natlangx.dto.ProcessRequest;
import com.natlangx.provider.AIProvider;
import com.natlangx.tools.CodeGeneratorTool;
import com.natlangx.tools.ComplexityAnalyzerTool;
import com.natlangx.tools.ExplanationTool;
import com.natlangx.tools.OptimizationTool;
import com.natlangx.tools.Tool;
import com.natlangx.tools.TopicClassifierTool;

@Component
public class CodeAgent {
    private final List<AIProvider> providers;
    private final ComplexityAnalyzer complexityAnalyzer;

    public CodeAgent(List<AIProvider> providers, ComplexityAnalyzer complexityAnalyzer) {
        this.providers = providers;
        this.complexityAnalyzer = complexityAnalyzer;
    }

    public AgentResponse process(ProcessRequest request, String projectSuggestions) {
        String language = request.getLanguage();
        String prompt = safe(request.getPrompt());
        String code = safe(request.getCode());
        String action = safe(request.getAction());
        AIProvider aiProvider = resolveProvider(request.getProvider());

        String actionLower = action.toLowerCase(Locale.ROOT);
        if ("summarize".equals(actionLower)) {
            try {
                return summarizeOnly(aiProvider, language, code, projectSuggestions);
            } catch (Exception e) {
                AIProvider fallback = getFallbackProvider(aiProvider);
                if (fallback != aiProvider) {
                    return summarizeOnly(fallback, language, code, projectSuggestions);
                }
                throw e;
            }
        }
        if ("better".equals(actionLower)) {
            try {
                return suggestBetterOnly(aiProvider, language, code, projectSuggestions);
            } catch (Exception e) {
                AIProvider fallback = getFallbackProvider(aiProvider);
                if (fallback != aiProvider) {
                    return suggestBetterOnly(fallback, language, code, projectSuggestions);
                }
                throw e;
            }
        }

        if (("optimize".equalsIgnoreCase(action) || "summarize".equalsIgnoreCase(action) || "better".equalsIgnoreCase(action))
                && code.isBlank()) {
            throw new IllegalArgumentException("Selected code is required for optimize, summarize, or better actions.");
        }

        AgentDecision decision = decide(action, prompt, code);
        AgentResponse response = new AgentResponse();

        // Only classify topic for auto actions, not for explicit optimize/summarize/better
        if ("auto".equalsIgnoreCase(action)) {
            Tool topicTool = new TopicClassifierTool();
            response.setTopic(topicTool.execute(prompt + "\n" + code));
        } else {
            response.setTopic("");
        }

        String workingCode = code;

        if (decision.isShouldGenerate()) {
            Tool generator = new CodeGeneratorTool(aiProvider, language);
            workingCode = generator.execute(prompt);
            workingCode = AIProvider.normalizeGeneratedCode(workingCode);
            decision.getSteps().add("Generated");
        }

        AnalysisResult analysisResult = new AnalysisResult("O(1)", "O(1)", "No suggestions");

        if (decision.isShouldAnalyze()) {
            Tool analyzerTool = new ComplexityAnalyzerTool(complexityAnalyzer, language);
            analysisResult = parseAnalysis(analyzerTool.execute(workingCode));
            decision.getSteps().add("Analyzed");
        }

        if (decision.isShouldOptimize()) {
            Tool optimizer = new OptimizationTool(aiProvider, language);
            workingCode = optimizer.execute(workingCode);
            workingCode = AIProvider.normalizeGeneratedCode(workingCode);
            decision.getSteps().add("Optimized");

            // Only re-optimize if action is explicitly optimize AND result is still quadratic
            if ("optimize".equalsIgnoreCase(action)) {
                analysisResult = complexityAnalyzer.analyze(workingCode, language);
                if ("O(n^2)".equals(analysisResult.getTimeComplexity())) {
                    workingCode = optimizer.execute(workingCode);
                    workingCode = AIProvider.normalizeGeneratedCode(workingCode);
                    decision.getSteps().add("Optimized-Again");
                    analysisResult = complexityAnalyzer.analyze(workingCode, language);
                }
            }
        }

        // Only explain if explicitly requested via action parameter (not for standalone optimize/better)
        if (decision.isShouldExplain() && "auto".equals(action)) {
            Tool explainer = new ExplanationTool(aiProvider, language);
            response.setExplanation(explainer.execute(workingCode));
            decision.getSteps().add("Explained");
        }

        response.setOptimizedCode(workingCode);
        response.setFinalCode(workingCode);
        response.setTimeComplexity(analysisResult.getTimeComplexity());
        response.setSpaceComplexity(analysisResult.getSpaceComplexity());
        response.setSuggestions(mergeSuggestions(analysisResult.getSuggestions(), projectSuggestions));
        response.setSteps(decision.getSteps());
        response.setDecisionLog(decision.getDecisionLog() + " | Provider: " + aiProvider.providerName());
        return response;
    }

    private AgentResponse summarizeOnly(AIProvider aiProvider, String language, String code, String projectSuggestions) {
        if (code.isBlank()) {
            throw new IllegalArgumentException("Selected code is required for summarize action.");
        }

        AgentResponse response = new AgentResponse();
        String summary = aiProvider.summarizeMeaning(code, language);
        response.setFinalCode("");
        response.setOptimizedCode("");
        response.setExplanation(summary);
        response.setTimeComplexity("-");
        response.setSpaceComplexity("-");
        response.setSuggestions(mergeSuggestions("Summary-only mode.", projectSuggestions));
        response.setTopic("");  // Skip topic classification for summarize
        response.setSteps(List.of("Summarized"));
        response.setDecisionLog("Agent chose summarize-only semantic pipeline | Provider: " + aiProvider.providerName());
        return response;
    }

    private AgentResponse suggestBetterOnly(AIProvider aiProvider, String language, String code, String projectSuggestions) {
        if (code.isBlank()) {
            throw new IllegalArgumentException("Selected code is required for better action.");
        }

        AnalysisResult analysis = complexityAnalyzer.analyze(code, language);
        String improvementPlan = aiProvider.suggestBetterOption(code, language);

        AgentResponse response = new AgentResponse();
        response.setFinalCode("");
        response.setOptimizedCode("");
        response.setExplanation(improvementPlan);
        response.setTimeComplexity(analysis.getTimeComplexity());
        response.setSpaceComplexity(analysis.getSpaceComplexity());
        response.setSuggestions(mergeSuggestions(analysis.getSuggestions(), projectSuggestions));
        response.setTopic("");  // Skip topic classification for better
        response.setSteps(List.of("Analyzed", "Suggested-Better-Path"));
        response.setDecisionLog("Agent chose better-option recommendation pipeline | Provider: " + aiProvider.providerName());
        return response;
    }

    private AIProvider getFallbackProvider(AIProvider current) {
        if ("heuristic".equalsIgnoreCase(current.providerName())) {
            return current;
        }
        for (AIProvider provider : providers) {
            if ("heuristic".equalsIgnoreCase(provider.providerName())) {
                return provider;
            }
        }
        return current;
    }

    private AIProvider resolveProvider(String providerName) {
        String requested = safe(providerName).toLowerCase(Locale.ROOT);
        for (AIProvider provider : providers) {
            if (provider.providerName().equalsIgnoreCase(requested)) {
                return provider;
            }
        }
        if (!requested.isBlank() && !"heuristic".equalsIgnoreCase(requested)) {
            throw new IllegalArgumentException("Provider '" + providerName + "' is not configured in backend. Supported providers: ollama, openai, gemini, anthropic, heuristic.");
        }
        for (AIProvider provider : providers) {
            if ("heuristic".equalsIgnoreCase(provider.providerName())) {
                return provider;
            }
        }
        throw new IllegalStateException("No AI provider is available in backend.");
    }

    private AgentDecision decide(String action, String prompt, String code) {
        AgentDecision decision = new AgentDecision();
        String lower = prompt.toLowerCase();
        String actionLower = action == null ? "" : action.toLowerCase();

        boolean hasCode = !code.isBlank();
        boolean asksOptimize = "optimize".equals(actionLower) || lower.contains("optimize");
        boolean asksExplain = lower.contains("explain");
        boolean asksSummarize = "summarize".equals(actionLower) || lower.contains("summarize") || lower.contains("summary");
        boolean asksBetter = "better".equals(actionLower) || lower.contains("better code") || lower.contains("improve") || lower.contains("refactor");

        if (asksSummarize) {
            decision.setShouldGenerate(false);
            decision.setShouldAnalyze(true);
            decision.setShouldOptimize(false);
            decision.setShouldExplain(true);
            decision.setDecisionLog("Agent chose summarize pipeline");
            return decision;
        }

        if (asksBetter) {
            decision.setShouldGenerate(!hasCode);
            decision.setShouldAnalyze(true);
            decision.setShouldOptimize(true);
            decision.setShouldExplain(true);
            decision.setDecisionLog("Agent chose better-code pipeline");
            return decision;
        }

        if (asksExplain && !asksOptimize) {
            decision.setShouldGenerate(false);
            decision.setShouldAnalyze(false);
            decision.setShouldOptimize(false);
            decision.setShouldExplain(true);
            decision.setDecisionLog("Agent chose explanation-only pipeline");
            return decision;
        }

        if (asksOptimize) {
            decision.setShouldGenerate(!hasCode);
            decision.setShouldAnalyze(true);
            decision.setShouldOptimize(true);
            decision.setShouldExplain(true);
            decision.setDecisionLog("Agent chose optimize-first pipeline");
            return decision;
        }

        if (!hasCode) {
            decision.setShouldGenerate(true);
            decision.setShouldAnalyze(true);
            decision.setShouldOptimize(true);
            decision.setShouldExplain(true);
            decision.setDecisionLog("Agent chose full generate-analyze-optimize-explain pipeline");
            return decision;
        }

        decision.setShouldGenerate(false);
        decision.setShouldAnalyze(true);
        decision.setShouldOptimize(true);
        decision.setShouldExplain(true);
        decision.setDecisionLog("Agent chose code-input analyze-optimize-explain pipeline");
        return decision;
    }

    private AnalysisResult parseAnalysis(String payload) {
        String[] parts = payload.split("\\|", -1);
        String time = parts.length > 0 ? parts[0] : "O(1)";
        String space = parts.length > 1 ? parts[1] : "O(1)";
        String sugg = parts.length > 2 ? parts[2] : "Complexity looks good.";
        return new AnalysisResult(time, space, sugg);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String mergeSuggestions(String analysisSuggestions, String projectSuggestions) {
        StringBuilder builder = new StringBuilder();
        if (analysisSuggestions != null && !analysisSuggestions.isBlank()) {
            builder.append(analysisSuggestions.trim());
        }
        if (projectSuggestions != null && !projectSuggestions.isBlank()) {
            if (!builder.isEmpty()) {
                builder.append(" ");
            }
            builder.append("Project suggestions: ").append(projectSuggestions.trim());
        }
        return builder.toString();
    }
}
