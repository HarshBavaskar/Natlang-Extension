# Configuration & Operations: NatLang Runtime Guide

This page documents how NatLang is configured, how credentials move between the extension and backend, and how the agentic pipeline behaves when a provider request fails.

## Configuration precedence

NatLang reads configuration from three layers:

1. VS Code settings in `package.json` and the Settings UI.
2. Environment variables consumed by the Java backend.
3. Backend local overrides in `backend/natlang-x-backend/src/main/resources/application-local.properties`.

The effective runtime value is whichever layer is closest to execution. In practice, this means the extension controls the user-facing provider selection, while the backend still honors its own environment and local override file when it starts.

## Frontend settings

The extension exposes the following core settings:

- `natlang.aiProvider`: selected provider (`ollama`, `anthropic`, `gemini`, `groq`, `openai`).
- `natlang.defaultLanguage`: the target language used when the sidebar or command does not override it.
- `natlang.ollamaBaseUrl` and `natlang.ollamaModel`: local model endpoint and model name.
- `natlang.anthropicModel`, `natlang.geminiModel`, `natlang.groqModel`, `natlang.openaiModel`: cloud model selectors.
- `natlang.backendBaseUrl`: the agentic backend endpoint, defaulting to `http://localhost:9001`.
- `natlang.autoLearnDictionaryFromGeneration`: learns successful pseudocode-to-code mappings.
- `natlang.dictionaryMode`: groups sidebar history by topic/file.
- `natlang.liveGeneration*`: line-by-line preview controls for the live generation mode.

The current default Ollama model in the extension is `gemma3:4b`, and the default backend-driven target language is `Python`.

## Credential flow

When the user runs `NatLang: Set API Key`, the extension now performs two actions:

1. Stores the normalized key in VS Code SecretStorage for the frontend runtime.
2. Writes the same key into `application-local.properties` for the backend provider entry that matches the selected provider.

This means a single key entry can update both halves of the product without forcing the user to copy values into multiple places by hand. After the key is written, the extension prompts the user to restart the backend so the Java process reloads the local override file.

If the backend local write fails, the extension still keeps the key in SecretStorage and warns the user that only the frontend side was updated.

## Backend environment variables

The Java service reads provider credentials and model settings from environment variables first. The most important ones are:

- `NATLANGX_DB_URL`, `NATLANGX_DB_USERNAME`, `NATLANGX_DB_PASSWORD`
- `NATLANGX_OLLAMA_BASE_URL`, `NATLANGX_OLLAMA_MODEL`
- `NATLANGX_OPENAI_BASE_URL`, `NATLANGX_OPENAI_MODEL`, `NATLANGX_OPENAI_API_KEY`
- `NATLANGX_GROQ_BASE_URL`, `NATLANGX_GROQ_MODEL`, `NATLANGX_GROQ_API_KEY`
- `NATLANGX_GEMINI_BASE_URL`, `NATLANGX_GEMINI_MODEL`, `NATLANGX_GEMINI_API_KEY`
- `NATLANGX_ANTHROPIC_BASE_URL`, `NATLANGX_ANTHROPIC_MODEL`, `NATLANGX_ANTHROPIC_API_KEY`

`application.properties` also imports `application-local.properties` if present, so local overrides take effect without modifying the checked-in defaults.

## Agentic request flow

The extension sends agentic requests to `POST /api/process` on the backend. The request payload typically includes:

- `action`: `auto`, `optimize`, `summarize`, or `better`
- `prompt`: the natural-language instruction
- `code`: the source code or generated draft to inspect
- `language`: the target language
- `provider`: the requested backend provider
- `projectContext`: an optional context blob collected from the workspace

The backend responds with final code, optimized code, complexity metrics, explanation text, topic classification, a decision log, and a `steps` array describing what happened in the pipeline.

## Provider fallback behavior

The backend agent now has a fallback path for provider failures. If the configured provider throws during generation, optimization, or explanation, the agent retries with the heuristic provider when one is registered.

The fallback logic is intentionally narrow:

- It is applied to generation, optimization, and explanation.
- It does not hide the original failure if no fallback provider exists.
- It records fallback-specific step markers such as `Generated-Fallback`, `Optimized-Fallback`, and `Explained-Fallback`.
- The fallback provider is reflected in the decision log so failures remain visible during debugging.

For explicit `optimize` requests, the agent may run an additional optimization pass if the first pass still leaves the code at quadratic complexity.

## Running the backend locally

A typical Windows PowerShell session looks like this:

1. Set database and provider environment variables.
2. Start the backend from `backend/natlang-x-backend`.
3. Point the extension's `natlang.backendBaseUrl` at the running backend if it differs from the default.

The backend listens on port `9001` by default.

## Operational checklist

- Keep the backend running separately from the extension when using the agentic pipeline.
- Restart the backend after changing provider keys or backend-only environment variables.
- Prefer SecretStorage for the extension side and environment variables for shared backend deployment secrets.
- Use `application-local.properties` for workspace-local backend overrides only.

## Related docs

- [Frontend Implementation](frontend-implementation.md)
- [Backend Implementation](backend-implementation.md)
- [Advanced Java Concepts](java-concepts.md)
