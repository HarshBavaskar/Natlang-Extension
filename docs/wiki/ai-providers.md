# AI Providers

NatLang supports five model backends in the extension and one fallback provider in the backend.

## Provider matrix

| Provider | Location | Default model | Credential source | Streaming transport |
|---|---|---:|---|---|
| Ollama | Local | `gemma3:4b` | No API key required | Ollama streaming JSON |
| Anthropic | Cloud | `claude-3-5-sonnet-20240620` in the extension, `claude-3-5-sonnet-20241022` in the backend defaults | SecretStorage and backend local override | SSE |
| Gemini | Cloud | `gemini-2.0-flash` in the extension, `gemini-1.5-flash` in the backend defaults | SecretStorage and backend local override | SSE |
| Groq | Cloud | `llama-3.3-70b-versatile` in the extension, `openai/gpt-oss-120b` in the backend defaults | SecretStorage and backend local override | SSE |
| OpenAI | Cloud | `gpt-4o` in the extension, `gpt-4o-mini` in the backend defaults | SecretStorage and backend local override | SSE |
| Heuristic | Backend-only | N/A | No key required | Deterministic string generation |

NatLang keeps the provider interfaces intentionally narrow so the extension can stream tokens from any provider with the same callback contract.

## Extension providers

The TypeScript side implements a single `AIProvider` interface with the following responsibilities:

- stream tokens via `generate(system, user, onToken)`,
- report configuration state with `isConfigured()`,
- expose a friendly `getName()`,
- expose the selected model through `getModel()`.

### Ollama

Ollama is the local provider. It defaults to `http://localhost:11434` and streams from `/api/generate`. The extension expects JSON chunks and appends the `response` field as tokens arrive. If the stream ends without output, the provider surfaces `OLLAMA_OFFLINE`.

### Anthropic

Anthropic uses `/v1/messages` with server-sent events and the `x-api-key` header. The extension sends the system prompt separately and places the user request in the message array.

### Gemini

Gemini uses the streaming `streamGenerateContent` endpoint with an API key query parameter. It sends the system prompt as `system_instruction` and the actual request as the user content.

### Groq

Groq uses the OpenAI-compatible `/openai/v1/chat/completions` endpoint with a bearer token. The extension sends a system message followed by a user message.

### OpenAI

OpenAI also uses an OpenAI-compatible chat completions endpoint with streaming enabled and a bearer token.

## Heuristic fallback provider

The backend includes a local heuristic provider that can answer requests without network access. It is used as a fallback when the preferred provider fails inside the agent pipeline.

The heuristic provider is intentionally simple:

- it returns small, deterministic snippets,
- it can synthesize trivial examples for common languages,
- it can provide lightweight summaries and improvement advice,
- it does not require credentials.

## Prompting and output cleanup

NatLang uses a strict prompt contract to keep provider output as code only.

### Prompt rules

The prompt builder tells the model to:

- emit raw code only,
- avoid markdown fences,
- avoid comments,
- use real operators instead of words like plus or minus,
- keep Java output in a complete class named `NatLangOutput`,
- preserve surrounding structure from the pseudocode.

### Output normalization

After generation, NatLang normalizes output by:

- stripping markdown fences and headings,
- removing comment-only lines,
- decoding escaped unicode artifacts,
- reversing operator words into symbols,
- collapsing excessive blank lines.

The extension and backend both apply cleanup because provider output can drift at either stage.

## Operational notes

- If a cloud provider key is missing, the extension raises a `NO_API_KEY:<provider>` error.
- If the backend provider call fails, the Java pipeline can retry with the heuristic provider.
- The frontend default provider is Ollama, but the active provider can be switched from the sidebar or settings.
- Provider health and runtime details are shown in the sidebar when the backend exposes them.

## Related docs

- [Frontend Implementation](frontend-implementation.md)
- [Backend Implementation](backend-implementation.md)
- [Configuration & Operations](configuration-and-operations.md)
