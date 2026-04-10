# Backend Implementation: NatLang X Engine

The NatLang X backend is a Spring Boot service that turns a pseudocode request into code, analysis, optimization guidance, and optional explanation output. It is intentionally small in surface area but rich in orchestration: the real work happens in the agent pipeline.

## Overview

The backend serves three jobs:

- Resolve the requested AI provider and model.
- Execute the agentic pipeline for generation, analysis, optimization, and explanation.
- Persist and expose history plus dictionary data for the extension.

The current runtime is designed to degrade gracefully. If the selected provider fails and a heuristic provider is available, the backend can retry the operation instead of hard failing immediately.

## Layered architecture

### Controller layer

Controllers expose HTTP endpoints such as:

- `POST /api/process`
- `POST /api/dictionary/ingest`
- `GET /api/dictionary`
- `GET /api/history`
- `POST /api/transpilations`
- `GET /api/transpilations`

Controller responsibilities are limited to request validation, routing, and translating Java exceptions into HTTP responses.

### Service layer

Services orchestrate the business logic:

- `AgentService` coordinates the agentic reasoning flow.
- `PipelineService` builds and enriches project context.
- `TranspilationService` stores and retrieves persisted history.
- `DictionaryService` manages learned term mappings.

The service layer is where the backend decides which tool to call, what to retry, and how to merge the final response.

### DAO layer

The persistence layer uses JDBC and manual SQL instead of a heavy ORM. This keeps the SQL explicit and makes it easier to reason about the data shape for history and dictionary records.

## CodeAgent pipeline

`CodeAgent` is the core orchestrator for `/api/process`. Its behavior depends on the incoming `action` field.

### Action modes

- `auto`: run the full decision pipeline and optionally classify the topic.
- `optimize`: focus on optimization and analysis.
- `summarize`: produce an explanation-style summary of the selected code.
- `better`: provide a higher-level improvement path instead of rewriting code.

The pipeline enforces code requirements for `optimize`, `summarize`, and `better`. If the caller does not provide code for one of those actions, the backend rejects the request early.

### Step order

For `auto` or mixed actions, the agent generally follows this order:

1. Select the provider.
2. Optionally generate code from the prompt.
3. Analyze complexity.
4. Optionally optimize the generated code.
5. Optionally explain the result.
6. Merge project suggestions with analysis suggestions.

The `steps` array in the response records what happened, which is useful for debugging and for the sidebar status display.

### Fallback behavior

The current implementation retries with the heuristic provider when the selected provider throws during generation, optimization, explanation, summary, or better-option synthesis.

This is important because it changes the backend from a single-provider dependency into a resilient pipeline:

- generation can continue even if the preferred provider is down,
- optimization can continue even if the chosen model is unavailable,
- explanation can still be produced when the cloud provider errors out,
- the final decision log records which provider actually produced the result.

Fallback markers are added to the `steps` list so the caller can tell when the response came from a retry path.

## Response shape

A successful response typically includes:

- `finalCode`: the final code emitted by the agent,
- `optimizedCode`: the code after optimization passes,
- `timeComplexity` and `spaceComplexity`:
  analysis results,
- `explanation`: summary or explanation text,
- `suggestions`: merged analysis and project suggestions,
- `topic`: the detected topic for `auto` actions,
- `steps`: pipeline markers,
- `decisionLog`: a human-readable summary of the route the agent took.

## Configuration model

The backend reads configuration from environment variables and from `application.properties`. It also imports optional `application-local.properties` so local overrides can be committed to a workspace without replacing the shared defaults.

Important values include:

- `natlangx.ollama.baseUrl` and `natlangx.ollama.model`
- `natlangx.openai.baseUrl`, `natlangx.openai.model`, and `natlangx.openai.apiKey`
- `natlangx.groq.baseUrl`, `natlangx.groq.model`, and `natlangx.groq.apiKey`
- `natlangx.gemini.baseUrl`, `natlangx.gemini.model`, and `natlangx.gemini.apiKey`
- `natlangx.anthropic.baseUrl`, `natlangx.anthropic.model`, and `natlangx.anthropic.apiKey`

The backend default port is `9001`.

## Persistence model

The backend stores two main kinds of records:

- transpilation history for user-visible audit and search,
- dictionary entries used by the learned term normalization pipeline.

Because persistence is JDBC-first, the repository can keep SQL queries explicit and tune them independently from the object model.

## API contract examples

### Example request

```json
{
  "userId": 1,
  "action": "optimize",
  "prompt": "reduce the nested loop cost",
  "code": "for (int i = 0; i < n; i++) { for (int j = 0; j < n; j++) { } }",
  "language": "Java",
  "provider": "openai",
  "projectContext": "Contains nested loops and TODO markers"
}
```

### Example response

```json
{
  "finalCode": "public class NatLangOutput { ... }",
  "optimizedCode": "public class NatLangOutput { ... }",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "explanation": "This code can be improved by...",
  "suggestions": "Reduce nested loops using hashing.",
  "topic": "Data Structures",
  "steps": ["Generated", "Analyzed", "Optimized", "Explained"],
  "decisionLog": "Agent chose optimize-first pipeline | Provider: openai"
}
```

## Operational notes

- The backend is best run separately from the extension when using agentic features.
- If a provider key changes, restart the backend so the Java process picks up the new local override.
- The heuristic fallback is a resilience layer, not a replacement for a properly configured provider.

## Related docs

- [Configuration & Operations](configuration-and-operations.md)
- [Frontend Implementation](frontend-implementation.md)
- [Advanced Java Concepts](java-concepts.md)
