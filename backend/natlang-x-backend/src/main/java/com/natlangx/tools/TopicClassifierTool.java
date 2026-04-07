package com.natlangx.tools;

public class TopicClassifierTool implements Tool {

    @Override
    public String execute(String input) {
        if (input == null || input.isBlank()) {
            return "General";
        }

        String lower = input.toLowerCase();
        if (containsAny(lower, "dp", "dynamic programming", "memoization", "tabulation")) {
            return "Dynamic Programming";
        }
        if (containsAny(lower, "tree", "heap", "stack", "queue", "hashmap", "linkedlist", "array")) {
            return "Data Structures";
        }
        if (containsAny(lower, "graph", "dfs", "bfs", "dijkstra", "shortest path")) {
            return "Graphs";
        }
        if (containsAny(lower, "spring", "rest", "http", "frontend", "react", "api")) {
            return "Web Development";
        }
        if (containsAny(lower, "neural", "regression", "classification", "training", "model")) {
            return "Machine Learning";
        }
        return "General";
    }

    private boolean containsAny(String source, String... terms) {
        for (String term : terms) {
            if (source.contains(term)) {
                return true;
            }
        }
        return false;
    }
}
