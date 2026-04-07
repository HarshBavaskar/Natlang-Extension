package com.natlangx.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PipelineService {

    public String buildProjectWideSuggestions(String projectContext) {
        if (projectContext == null || projectContext.isBlank()) {
            return "No project context provided.";
        }

        String lower = projectContext.toLowerCase();
        Map<String, String> suggestionMap = new LinkedHashMap<>();

        if (lower.contains("todo") || lower.contains("fixme")) {
            suggestionMap.put("cleanup", "Resolve TODO/FIXME markers before release.");
        }
        if (lower.contains("try") && !lower.contains("catch")) {
            suggestionMap.put("errors", "Add explicit exception handling around critical I/O calls.");
        }
        if (lower.contains("for (") && lower.contains("for (")) {
            suggestionMap.put("loops", "Review nested loops and consider hash-based indexing to reduce complexity.");
        }
        if (lower.contains("password") && !lower.contains("hash")) {
            suggestionMap.put("security", "Hash and salt credentials before persistence.");
        }
        if (lower.contains("select *")) {
            suggestionMap.put("sql", "Replace SELECT * with explicit columns for predictable query costs.");
        }
        if (lower.contains("@restcontroller") && !lower.contains("@valid")) {
            suggestionMap.put("validation", "Use request validation annotations on all API input DTOs.");
        }

        List<String> suggestions = new ArrayList<>(suggestionMap.values());
        if (suggestions.isEmpty()) {
            return "Project structure looks healthy. Consider adding integration tests for the critical flow.";
        }
        return String.join(" ", suggestions);
    }
}
