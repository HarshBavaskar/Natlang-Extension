package com.natlangx.provider;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.natlangx.dto.ProviderHealthStatus;

public abstract class AIProvider {
    public abstract String providerName();

    public String modelName() {
        return "";
    }

    public abstract String generateCode(String prompt, String language);

    public String optimizeCode(String code, String language) {
        return code;
    }

    public String summarizeMeaning(String code, String language) {
        return explainCode(code, language);
    }

    public String suggestBetterOption(String code, String language) {
        return explainCode(code, language);
    }

    public String explainCode(String code, String language) {
        return "Generated explanation for " + language + " code.";
    }

    public ProviderHealthStatus health() {
        return new ProviderHealthStatus(providerName(), true, true, "Provider is ready.");
    }

    public static String normalizeGeneratedCode(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        String result = value.trim();
        result = decodeUnicodeEscapes(result);
        result = unwrapMarkdownFence(result);
        result = stripMarkdownArtifacts(result);
        result = stripCommentOnlyLines(result);
        result = normalizeOperatorWords(result);
        result = decodeUnicodeEscapes(result);
        result = result.replaceAll("\\n{3,}", "\\n\\n").trim();
        return result;
    }

    private static String decodeUnicodeEscapes(String text) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '\\' && i + 5 < text.length() && text.charAt(i + 1) == 'u') {
                String hex = text.substring(i + 2, i + 6);
                if (hex.matches("[0-9a-fA-F]{4}")) {
                    builder.append((char) Integer.parseInt(hex, 16));
                    i += 5;
                    continue;
                }
            }
            if (ch == 'u' && i + 4 < text.length()) {
                String hex = text.substring(i + 1, i + 5);
                if (hex.matches("[0-9a-fA-F]{4}")) {
                    builder.append((char) Integer.parseInt(hex, 16));
                    i += 4;
                    continue;
                }
            }
            builder.append(ch);
        }
        return builder.toString();
    }

    private static String unwrapMarkdownFence(String text) {
        Matcher matcher = Pattern.compile("```(?:[\\w#+.-]+)?\\s*\\n?([\\s\\S]*?)\\n?```", Pattern.MULTILINE).matcher(text);
        if (matcher.find() && matcher.group(1) != null) {
            return matcher.group(1).trim();
        }
        return text;
    }

    private static String stripMarkdownArtifacts(String text) {
        String result = text;
        result = result.replaceAll("(?m)^\\s*```(?:[\\w#+.-]+)?\\s*$", "");
        result = result.replaceAll("(?m)^\\s*~~~(?:[\\w#+.-]+)?\\s*$", "");
        result = result.replaceAll("(?m)^\\s*#{1,6}\\s+", "");
        result = result.replaceAll("(?m)^\\s*(?:[-*+]|\\d+\\.)\\s+(?=[A-Za-z_])", "");
        result = result.replaceAll("(?m)^\\s*`([^`]+)`\\s*$", "$1");
        result = result.replaceAll("(?im)^\\s*(note|notes|comment|comments|explanation|summary|output|result)\\s*:\\s*.*$", "");
        return result;
    }

    private static String stripCommentOnlyLines(String text) {
        StringBuilder builder = new StringBuilder();
        String[] lines = text.split("\\R", -1);
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                builder.append('\n');
                continue;
            }
            if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("--")) {
                continue;
            }
            builder.append(line).append('\n');
        }
        return builder.toString().trim();
    }

    private static String normalizeOperatorWords(String text) {
        String result = text;
        result = replaceWordPhrase(result, "greater than or equal to", ">=");
        result = replaceWordPhrase(result, "greater than or equal", ">=");
        result = replaceWordPhrase(result, "less than or equal to", "<=");
        result = replaceWordPhrase(result, "less than or equal", "<=");
        result = replaceWordPhrase(result, "not equal to", "!=");
        result = replaceWordPhrase(result, "is equal to", "==");
        result = replaceWordPhrase(result, "equal to", "==");
        result = replaceWordPhrase(result, "greater than", ">");
        result = replaceWordPhrase(result, "less than", "<");
        result = replaceWordPhrase(result, "multiplied by", "*");
        result = replaceWordPhrase(result, "times", "*");
        result = replaceWordPhrase(result, "divided by", "/");
        result = replaceWordPhrase(result, "modulo", "%");
        result = replaceWordPhrase(result, "mod", "%");
        result = replaceWordPhrase(result, "plus", "+");
        result = replaceWordPhrase(result, "minus", "-");
        result = replaceWordPhrase(result, "and", "&&");
        result = replaceWordPhrase(result, "or", "||");
        result = replaceWordPhrase(result, "not", "!");
        return result;
    }

    private static String replaceWordPhrase(String text, String phrase, String replacement) {
        return text.replaceAll("(?i)\\b" + Pattern.quote(phrase) + "\\b", replacement);
    }
}
