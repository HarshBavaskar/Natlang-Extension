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
public class AnthropicAIProvider extends AIProvider {
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${natlangx.anthropic.apiKey:}")
    private String apiKey;

    @Value("${natlangx.anthropic.baseUrl:https://api.anthropic.com}")
    private String baseUrl;

    @Value("${natlangx.anthropic.model:claude-3-5-sonnet-20241022}")
    private String model;

    @Override
    public String providerName() {
        return "anthropic";
    }

    @Override
    public ProviderHealthStatus health() {
        boolean configured = apiKey != null && !apiKey.isBlank();
        if (!configured) {
            return new ProviderHealthStatus(providerName(), false, false, "Missing NATLANGX_ANTHROPIC_API_KEY.");
        }

        String endpoint = stripTrailingSlash(baseUrl) + "/v1/models";
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(5))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            boolean ok = response.statusCode() < 400;
            return new ProviderHealthStatus(providerName(), true, ok, ok
                    ? "Anthropic reachable at models endpoint"
                    : "Anthropic returned status " + response.statusCode());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new ProviderHealthStatus(providerName(), true, false, "Anthropic health check interrupted: " + ex.getMessage());
        } catch (IOException | RuntimeException ex) {
            return new ProviderHealthStatus(providerName(), true, false, "Anthropic unreachable: " + ex.getMessage());
        }
    }

    @Override
    public String generateCode(String prompt, String language) {
        String instruction = "Generate clean " + safe(language) + " code only. No markdown fences, no comments, no notes. "
                + "Use real operators and punctuation only; never spell operators as words. Prompt: " + safe(prompt);
        return message(instruction);
    }

    @Override
    public String optimizeCode(String code, String language) {
        String instruction = "Optimize this " + safe(language)
                + " code for time and space complexity while preserving behavior. Return code only, no commentary, no notes, no markdown. "
                + "Use real operators and punctuation only; never spell operators as words.\nCode:\n"
                + safe(code);
        return message(instruction);
    }

    @Override
    public String explainCode(String code, String language) {
        return summarizeMeaning(code, language);
    }

    @Override
    public String summarizeMeaning(String code, String language) {
        String instruction = "You are a deterministic code analyst. Return plain text only (no markdown, no code). "
                + "Summarize the meaning of this " + safe(language)
                + " code with exactly three sections: Purpose, Flow, Outcome.\nCode:\n"
                + safe(code);
        return message(instruction);
    }

    @Override
    public String suggestBetterOption(String code, String language) {
        String instruction = "You are a deterministic software architect. Return plain text only (no markdown, no code). "
                + "Provide exactly four numbered next-step recommendations to improve this " + safe(language)
                + " codebase for maintainability, performance, reliability, and testing.\nCode:\n"
                + safe(code);
        return message(instruction);
    }

    private String message(String instruction) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Anthropic API key is not configured. Set NATLANGX_ANTHROPIC_API_KEY.");
        }

        String endpoint = stripTrailingSlash(baseUrl) + "/v1/messages";
        String payload = "{"
                + "\"model\":\"" + escapeJson(model) + "\"," 
                + "\"max_tokens\":2048,"
            + "\"temperature\":0,"
                + "\"messages\":[{" 
                + "\"role\":\"user\"," 
                + "\"content\":\"" + escapeJson(instruction) + "\"" 
                + "}]"
                + "}";

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new RuntimeException("Anthropic call failed with status " + response.statusCode() + ": " + response.body());
            }

            String content = extractJsonStringFieldAfter(response.body(), "\"text\":\"");
            if (content.isBlank()) {
                throw new RuntimeException("Anthropic response did not include generated text.");
            }
            return content;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to call Anthropic provider: " + ex.getMessage(), ex);
        } catch (IOException ex) {
            throw new RuntimeException("Failed to call Anthropic provider: " + ex.getMessage(), ex);
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
            return "https://api.anthropic.com";
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
