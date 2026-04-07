package com.natlangx.provider;

import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.natlangx.dto.ProviderHealthStatus;

@Component
public class HeuristicAIProvider extends AIProvider {
    @Override
    public String providerName() {
        return "heuristic";
    }

    @Override
    public ProviderHealthStatus health() {
        return new ProviderHealthStatus(providerName(), true, true, "Local heuristic provider is available.");
    }

    @Override
    public String generateCode(String prompt, String language) {
        String lower = prompt == null ? "" : prompt.toLowerCase();
        String safePrompt = escape(prompt);
        String lang = language == null ? "" : language.toLowerCase();
        if ("java".equalsIgnoreCase(language)) {
            if (lower.contains("factorial")) {
                return """
                        public class NatLangOutput {
                            public static long factorial(int n) {
                                if (n < 0) throw new IllegalArgumentException("n must be >= 0");
                                long result = 1L;
                                for (int i = 2; i <= n; i++) {
                                    result *= i;
                                }
                                return result;
                            }

                            public static void main(String[] args) {
                                System.out.println(factorial(5));
                            }
                        }
                        """;
            }
            return """
                    public class NatLangOutput {
                        public static void main(String[] args) {
                            System.out.println("Generated from prompt: %s");
                        }
                    }
                    """.formatted(safePrompt);
        }
        if (lang.contains("python")) {
            return "print(\"Generated from prompt: %s\")".formatted(safePrompt);
        }
        if (lang.contains("javascript") || lang.contains("typescript") || lang.contains("jsx") || lang.contains("vue") || lang.contains("node")) {
            return "console.log(\"Generated from prompt: %s\");".formatted(safePrompt);
        }
        if (lang.contains("c#")) {
            return """
                    using System;

                    public class NatLangOutput {
                        public static void Main() {
                            Console.WriteLine("Generated from prompt: %s");
                        }
                    }
                    """.formatted(safePrompt);
        }
        if (lang.contains("c++") || lang.contains("c")) {
            return """
                    #include <stdio.h>

                    int main(void) {
                        printf("Generated from prompt: %s\\n");
                        return 0;
                    }
                    """.formatted(safePrompt);
        }
        return "print(\"Generated from prompt: %s\")".formatted(safePrompt);
    }

    @Override
    public String optimizeCode(String code, String language) {
        if (code == null) {
            return "";
        }
        String lang = language == null ? "" : language.toLowerCase();
        String optimized = code;

        if (lang.contains("java")) {
            optimized = optimizeJava(optimized);
        } else if (lang.contains("javascript") || lang.contains("typescript") || lang.contains("jsx") || lang.contains("vue")) {
            optimized = optimizeJavaScriptLike(optimized);
        } else if (lang.contains("python")) {
            optimized = optimizePython(optimized);
        }

        return applyCommonOptimizations(optimized);
    }

    private String optimizeJava(String input) {
        String optimized = input;

        // Cache list size in index-based loops.
        optimized = Pattern.compile("for\\s*\\(\\s*int\\s+(\\w+)\\s*=\\s*0\\s*;\\s*\\1\\s*<\\s*([A-Za-z_][A-Za-z0-9_\\.]*)\\.size\\(\\)\\s*;\\s*\\1\\+\\+\\s*\\)")
            .matcher(optimized)
            .replaceAll("for (int $1 = 0, n = $2.size(); $1 < n; $1++)");

        // Cache array length in index-based loops.
        optimized = Pattern.compile("for\\s*\\(\\s*int\\s+(\\w+)\\s*=\\s*0\\s*;\\s*\\1\\s*<\\s*([A-Za-z_][A-Za-z0-9_\\.]*)\\.length\\s*;\\s*\\1\\+\\+\\s*\\)")
            .matcher(optimized)
            .replaceAll("for (int $1 = 0, n = $2.length; $1 < n; $1++)");

        // Prefer StringBuilder in the common accumulator pattern.
        if (optimized.contains("String result = \"\";")) {
            optimized = optimized.replace("String result = \"\";", "StringBuilder result = new StringBuilder();");
            optimized = Pattern.compile("result\\s*=\\s*result\\s*\\+\\s*(.*?);")
                    .matcher(optimized)
                    .replaceAll("result.append($1);");
            optimized = optimized.replace("return result;", "return result.toString();");
        }

        return optimized;
    }

    private String optimizeJavaScriptLike(String input) {
        String optimized = input;

        // Cache array length for repeated bound checks.
        optimized = Pattern.compile("for\\s*\\(\\s*(let|var|const)\\s+(\\w+)\\s*=\\s*0\\s*;\\s*\\2\\s*<\\s*([A-Za-z_][A-Za-z0-9_\\.]*)\\.length\\s*;\\s*\\2\\+\\+\\s*\\)")
            .matcher(optimized)
            .replaceAll("for ($1 $2 = 0, n = $3.length; $2 < n; $2++)");

        // Replace reduce pattern for summation when obvious.
        optimized = optimized.replace("let sum = 0;\nfor (let i = 0, n = arr.length; i < n; i++) {\n  sum += arr[i];\n}",
                "const sum = arr.reduce((acc, value) => acc + value, 0);");

        return optimized;
    }

    private String optimizePython(String input) {
        String optimized = input;

        // Prefer direct iteration over range(len(...)) for readability and safety.
        optimized = Pattern.compile("for\\s+(\\w+)\\s+in\\s+range\\(len\\((\\w+)\\)\\):")
                .matcher(optimized)
                .replaceAll("for $1, _item in enumerate($2):");

        // Prefer list comprehension append loops when shape is obvious.
        optimized = optimized.replace("result = []\nfor x in values:\n    result.append(transform(x))",
                "result = [transform(x) for x in values]");

        return optimized;
    }

    private String applyCommonOptimizations(String input) {
        String optimized = input;

        // Eliminate repeated trim + isEmpty checks.
        optimized = optimized.replace("if (s != null && s.trim().length() > 0)", "if (s != null && !s.isBlank())");
        optimized = optimized.replace("if (s != null && s.trim().isEmpty())", "if (s != null && s.isBlank())");

        return optimized;
    }

    @Override
    public String summarizeMeaning(String code, String language) {
        if (code == null || code.isBlank()) {
            return "No code provided to summarize.";
        }

        int lines = code.split("\\R").length;
        int loops = Pattern.compile("\\b(for|while)\\b").matcher(code).results().toArray().length;
        int conditions = Pattern.compile("\\b(if|switch)\\b").matcher(code).results().toArray().length;
        int functions = Pattern.compile("\\b(function|def|class|public\\s+static|public\\s+|private\\s+)\\b").matcher(code).results().toArray().length;

        return "Meaning summary (" + language + "): This code appears to implement a deterministic transformation with "
                + loops + " loop(s), "
                + conditions + " conditional branch(es), and "
                + functions + " function/class signature marker(s) across "
                + lines + " lines. It processes input predictably and can be improved by reducing repeated scans and isolating reusable logic.";
    }

    @Override
    public String suggestBetterOption(String code, String language) {
        if (code == null || code.isBlank()) {
            return "No code provided for improvement suggestions.";
        }

        return "Better path forward (" + language + "):\n"
                + "1. Extract complex blocks into named helper functions for readability and testability.\n"
                + "2. Replace repeated scans or nested loops with indexed caches/maps where correctness allows.\n"
                + "3. Add explicit input validation and early returns for invalid cases.\n"
                + "4. Add targeted tests for edge cases and complexity-critical paths before refactoring further.";
    }

    @Override
    public String explainCode(String code, String language) {
        return summarizeMeaning(code, language);
    }

    private String escape(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
