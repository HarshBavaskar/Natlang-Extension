package com.natlangx.provider;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.natlangx.dto.ProviderHealthStatus;

@Component
public class OllamaAIProvider extends AIProvider {
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    @Value("${natlangx.ollama.baseUrl:http://127.0.0.1:11434}")
    private String baseUrl;

    @Value("${natlangx.ollama.model:llama3:latest}")
    private String model;

    @Override
    public String providerName() {
        return "ollama";
    }

    @Override
    public String modelName() {
        return model;
    }

    @Override
    public ProviderHealthStatus health() {
        String endpoint = stripTrailingSlash(baseUrl) + "/api/tags";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                updateUsageSummary(response.headers());
            boolean ok = response.statusCode() < 400;
            return new ProviderHealthStatus(providerName(), true, ok, ok
                    ? "Ollama reachable at " + endpoint
                    : "Ollama returned status " + response.statusCode());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new ProviderHealthStatus(providerName(), true, false, "Ollama health check interrupted: " + ex.getMessage());
        } catch (IOException | RuntimeException ex) {
            return new ProviderHealthStatus(providerName(), true, false, "Ollama unreachable: " + ex.getMessage());
        }
    }

    @Override
    public String generateCode(String prompt, String language) {
        String instruction = "Generate clean " + safe(language) + " code only. No markdown fences, no comments, no notes. "
                + "Use real operators and punctuation only; never spell operators as words. "
                + "Preserve line breaks and proper indentation. Return code only with each statement on its own line. "
                + "Prompt: " + safe(prompt);
        String result = callOllama(instruction);
        return normalizeGeneratedCode(result);
    }

    @Override
    public String optimizeCode(String code, String language) {
        String instruction = "Optimize the following " + safe(language)
            + " code for time and space complexity while preserving behavior. Return ONLY the optimized code."
            + " Preserve line breaks and proper indentation. Each statement on its own line."
            + " No commentary, no notes, no markdown, no explanations. "
            + "Use real operators and punctuation only; never spell operators as words.\nCode:\n"
                + safe(code);
        String result = callOllama(instruction);
        return normalizeGeneratedCode(result);
    }

    @Override
    public String explainCode(String code, String language) {
        return summarizeMeaning(code, language);
    }

    @Override
    public String summarizeMeaning(String code, String language) {
        String instruction = "You are a deterministic code analyst. Return plain text only (no markdown, no code). "
                + "Summarize the meaning of this " + safe(language)
                + " code with exactly three sections: Purpose, Flow, Outcome. Code:\n"
                + safe(code);
        String result = callOllama(instruction);
        return stripPromptArtifacts(result);
    }

    @Override
    public String suggestBetterOption(String code, String language) {
        String instruction = "You are a deterministic software architect. Return plain text only (no markdown, no code). "
                + "Provide exactly four numbered next-step recommendations to improve this " + safe(language)
                + " codebase for maintainability, performance, reliability, and testing. Code:\n"
                + safe(code);
        String result = callOllama(instruction);
        return stripPromptArtifacts(result);
    }

    private String callOllama(String prompt) {
        String endpoint = stripTrailingSlash(baseUrl) + "/api/generate";
        try {
            String resolvedModel = resolveModel();
            String payload = "{"
                    + "\"model\":\"" + escapeJson(resolvedModel) + "\"," 
                    + "\"prompt\":\"" + escapeJson(prompt) + "\","
                    + "\"stream\":true,"
                    + "\"options\":{\"temperature\":0,\"top_p\":1,\"seed\":42}"
                    + "}";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(300))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            updateUsageSummary(response.headers());
            if (response.statusCode() >= 400) {
                throw new RuntimeException("Ollama call failed with status " + response.statusCode() + " from " + endpoint + " using model " + resolvedModel + ". Response: " + summarize(response.body()));
            }

            // Parse streaming response: each line is a JSON object with "response" field
            StringBuilder fullText = new StringBuilder();
            String[] lines = response.body().split("\n");
            for (String line : lines) {
                if (line.trim().isBlank()) {
                    continue;
                }
                String chunk = extractJsonStringField(line, "response");
                if (!chunk.isBlank()) {
                    fullText.append(chunk);
                }
            }
            
            String text = fullText.toString().trim();
            if (text.isBlank()) {
                throw new RuntimeException("Ollama streaming response did not contain generated text from " + endpoint + " using model " + resolvedModel + ". Raw response: " + summarize(response.body()));
            }
            
            // Normalize the final result to remove prompt artifacts and single-line encoding
            return normalizeGeneratedCode(text);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(buildErrorMessage("Failed to call Ollama provider", endpoint, ex), ex);
        } catch (IOException ex) {
            throw new RuntimeException(buildErrorMessage("Failed to call Ollama provider", endpoint, ex), ex);
        } catch (RuntimeException ex) {
            throw new RuntimeException(buildErrorMessage("Failed to call Ollama provider", endpoint, ex), ex);
        }
    }

    private String buildErrorMessage(String prefix, String endpoint, Throwable throwable) {
        return prefix + " at " + endpoint + " using model " + model + ": " + describeThrowable(throwable);
    }

    private String resolveModel() {
        String configured = safe(model).trim();
        List<String> installedModels = fetchInstalledModels();
        if (!configured.isBlank() && matchesAny(configured, installedModels)) {
            return configured;
        }
        if (!installedModels.isEmpty()) {
            return installedModels.get(0);
        }
        if (!configured.isBlank()) {
            return configured;
        }
        return "llama3:latest";
    }

    private boolean matchesAny(String modelName, List<String> installedModels) {
        for (String installed : installedModels) {
            if (installed.equalsIgnoreCase(modelName)) {
                return true;
            }
        }
        return false;
    }

    private List<String> fetchInstalledModels() {
        String endpoint = stripTrailingSlash(baseUrl) + "/api/tags";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(2))
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                return List.of();
            }
            return parseModelNames(response.body());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return List.of();
        } catch (IOException | RuntimeException ex) {
            return List.of();
        }
    }

    private List<String> parseModelNames(String json) {
        List<String> models = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return models;
        }
        String marker = "\"name\":\"";
        int index = 0;
        while ((index = json.indexOf(marker, index)) >= 0) {
            int start = index + marker.length();
            StringBuilder sb = new StringBuilder();
            boolean escape = false;
            int i = start;
            while (i < json.length()) {
                char ch = json.charAt(i++);
                if (escape) {
                    switch (ch) {
                        case '"', '\\', '/' -> sb.append(ch);
                        case 'n' -> sb.append('\n');
                        case 'r' -> sb.append('\r');
                        case 't' -> sb.append('\t');
                        case 'u' -> {
                            if (i + 3 < json.length()) {
                                String hex = json.substring(i, i + 4);
                                if (hex.matches("[0-9a-fA-F]{4}")) {
                                    sb.append((char) Integer.parseInt(hex, 16));
                                    i += 4;
                                    break;
                                }
                            }
                            sb.append('u');
                        }
                        default -> sb.append(ch);
                    }
                    escape = false;
                    continue;
                }
                if (ch == '\\') {
                    escape = true;
                    continue;
                }
                if (ch == '"') {
                    break;
                }
                sb.append(ch);
            }
            if (!sb.isEmpty()) {
                models.add(sb.toString());
            }
            index = i;
        }
        return models;
    }

    private String stripPromptArtifacts(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        
        // Remove lines starting with prompt indicators
        String result = text.replaceAll("(?im)^\\s*(You are|Provide|Summarize|Return|Here|Note:|Explanation:).*$", "").trim();
        
        // Remove any remaining structured prompts
        result = result.replaceAll("(?im)^##.*$", "");
        result = result.replaceAll("(?im)^###.*$", "");
        
        // Clean up multiple blank lines
        result = result.replaceAll("\\n{3,}", "\n\n").trim();
        
        return result;
    }

    private String describeThrowable(Throwable throwable) {
        if (throwable == null) {
            return "unknown error";
        }
        String message = throwable.getMessage();
        if (message == null || message.isBlank()) {
            message = throwable.getClass().getSimpleName();
        } else {
            message = throwable.getClass().getSimpleName() + ": " + message;
        }
        Throwable cause = throwable.getCause();
        if (cause != null && cause != throwable) {
            message += " | cause: " + describeThrowable(cause);
        }
        return message;
    }

    private String summarize(String value) {
        if (value == null || value.isBlank()) {
            return "<empty>";
        }
        String compact = value.replaceAll("\\s+", " ").trim();
        return compact.length() > 500 ? compact.substring(0, 500) + "..." : compact;
    }

    private String extractJsonStringField(String json, String fieldName) {
        String key = "\"" + fieldName + "\":\"";
        int start = json.indexOf(key);
        if (start < 0) {
            return "";
        }
        int i = start + key.length();
        StringBuilder sb = new StringBuilder();
        boolean escape = false;
        while (i < json.length()) {
            char ch = json.charAt(i++);
            if (escape) {
                switch (ch) {
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    default -> sb.append(ch);
                }
                escape = false;
                continue;
            }
            if (ch == '\\') {
                escape = true;
                continue;
            }
            if (ch == '"') {
                break;
            }
            sb.append(ch);
        }
        return sb.toString();
    }

    private String stripTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "http://127.0.0.1:11434";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
