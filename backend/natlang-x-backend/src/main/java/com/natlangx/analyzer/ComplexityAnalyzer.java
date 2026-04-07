package com.natlangx.analyzer;

import org.springframework.stereotype.Component;

@Component
public class ComplexityAnalyzer extends CodeAnalyzer {

    @Override
    public AnalysisResult analyze(String code, String language) {
        String safeCode = code == null ? "" : code;
        String lower = safeCode.toLowerCase();

        int forCount = countOccurrences(lower, "for (") + countOccurrences(lower, "for(");
        int whileCount = countOccurrences(lower, "while (") + countOccurrences(lower, "while(");
        int loopCount = forCount + whileCount;
        int nestedLoopSignal = countNestedLoopSignal(lower);

        String timeComplexity;
        if (nestedLoopSignal > 0 || loopCount >= 2) {
            timeComplexity = "O(n^2)";
        } else if (lower.contains("binarysearch") || lower.contains("mid =") || lower.contains("left <= right")) {
            timeComplexity = "O(log n)";
        } else if (loopCount == 1) {
            timeComplexity = "O(n)";
        } else {
            timeComplexity = "O(1)";
        }

        String spaceComplexity = lower.contains("new ") || lower.contains("arraylist") || lower.contains("hashmap")
                ? "O(n)"
                : "O(1)";

        String suggestions;
        if ("O(n^2)".equals(timeComplexity)) {
            suggestions = "Reduce nested loops using hashing, pre-indexing, or two-pointer strategies.";
        } else if ("O(n)".equals(timeComplexity)) {
            suggestions = "Cache repeated computations and avoid repeated collection size calls in loop conditions.";
        } else {
            suggestions = "Complexity is acceptable; focus on readability and edge-case handling.";
        }

        return new AnalysisResult(timeComplexity, spaceComplexity, suggestions);
    }

    private int countOccurrences(String source, String token) {
        int count = 0;
        int idx = 0;
        while ((idx = source.indexOf(token, idx)) != -1) {
            count++;
            idx += token.length();
        }
        return count;
    }

    private int countNestedLoopSignal(String source) {
        int nested = 0;
        String[] lines = source.split("\\n");
        int braceDepthAtLoop = -1;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("for") || trimmed.startsWith("while")) {
                if (braceDepthAtLoop >= 0 && currentDepth(line) > braceDepthAtLoop) {
                    nested++;
                }
                braceDepthAtLoop = currentDepth(line);
            }
        }
        return nested;
    }

    private int currentDepth(String line) {
        int depth = 0;
        for (char c : line.toCharArray()) {
            if (c == '{') {
                depth++;
            }
        }
        return depth;
    }
}
