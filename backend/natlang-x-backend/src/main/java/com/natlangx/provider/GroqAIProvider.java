package com.natlangx.provider;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.natlangx.dto.ProviderHealthStatus;

@Component
public class GroqAIProvider extends AIProvider {
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${natlangx.groq.apiKey:}")
    private String apiKey;

    @Value("${natlangx.groq.baseUrl:https://api.groq.com}")
    private String baseUrl;

    @Value("${natlangx.groq.model:llama-3.3-70b-versatile}")
    private String model;

    @Override
    public String providerName() {
        return "groq";
    }

    @Override
    public String modelName() {
        return model;
    }

    @Override
    public ProviderHealthStatus health() {
        boolean configured = apiKey != null && !apiKey.isBlank();
        if (!configured) {
            return new ProviderHealthStatus(providerName(), false, false, "Missing NATLANGX_GROQ_API_KEY.");
        }

        String endpoint = stripTrailingSlash(baseUrl) + "/openai/v1/models";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            updateUsageSummary(response.headers());
            boolean ok = response.statusCode() < 400;
            return new ProviderHealthStatus(providerName(), true, ok, ok
                    ? "Groq reachable at models endpoint"
                    : "Groq returned status " + response.statusCode());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new ProviderHealthStatus(providerName(), true, false, "Groq health check interrupted: " + ex.getMessage());
        } catch (IOException | RuntimeException ex) {
            return new ProviderHealthStatus(providerName(), true, false, "Groq unreachable: " + ex.getMessage());
        }
    }

    @Override
    public String generateCode(String prompt, String language) {
        String instruction = "Generate clean " + safe(language) + " code only. No markdown fences, no comments, no notes. "
                + "Use real operators and punctuation only; never spell operators as words. Prompt: " + safe(prompt);
        return chat(instruction);
    }

    @Override
    public String optimizeCode(String code, String language) {
        String instruction = "Optimize this " + safe(language)
                + " code for time and space complexity while preserving behavior. Return code only, no commentary, no notes, no markdown. "
                + "Use real operators and punctuation only; never spell operators as words. Code:\n"
                + safe(code);
        return chat(instruction);
    }

    @Override
    public String summarizeMeaning(String code, String language) {
        String instruction = "You are a deterministic code analyst. Return plain text only (no markdown, no code). "
                + "Summarize the meaning of this " + safe(language)
                + " code with exactly three sections: Purpose, Flow, Outcome.\nCode:\n"
                + safe(code);
        return chat(instruction);
    }

    @Override
    public String suggestBetterOption(String code, String language) {
        String instruction = "You are a deterministic software architect. Return plain text only (no markdown, no code). "
                + "Provide exactly four numbered next-step recommendations to improve this " + safe(language)
                + " codebase for maintainability, performance, reliability, and testing. Code:\n"
                + safe(code);
        return chat(instruction);
    }

    private String chat(String instruction) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Groq API key is not configured. Set NATLANGX_GROQ_API_KEY.");
        }

        String endpoint = stripTrailingSlash(baseUrl) + "/openai/v1/chat/completions";
        String payload = "{"
                + "\"model\":\"" + escapeJson(model) + "\"," 
                + "\"messages\":[{"
                + "\"role\":\"user\","
                + "\"content\":\"" + escapeJson(instruction) + "\""
                + "}],"
                + "\"temperature\":0"
                + "}";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            updateUsageSummary(response.headers());
            if (response.statusCode() >= 400) {
                throw new RuntimeException("Groq call failed with status " + response.statusCode() + ": " + response.body());
            }

            String content = extractJsonStringFieldAfter(response.body(), "\"content\":\"");
            if (content.isBlank()) {
                throw new RuntimeException("Groq response did not include assistant content.");
            }
            return content;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to call Groq provider: " + ex.getMessage(), ex);
        } catch (IOException ex) {
            throw new RuntimeException("Failed to call Groq provider: " + ex.getMessage(), ex);
        }
    }

    private String extractJsonStringFieldAfter(String json, String marker) {
        int start = json.indexOf(marker);
        if (start < 0) {
            return "";
        }
        int i = start + marker.length();
        StringBuilder sb = new StringBuilder();
        boolean escaped = false;
        while (i < json.length()) {
            char ch = json.charAt(i++);
            if (escaped) {
                switch (ch) {
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case 'u' -> {
                        if (i + 4 < json.length()) {
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
                escaped = false;
                continue;
            }
            if (ch == '\\') {
                escaped = true;
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
            return "https://api.groq.com";
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