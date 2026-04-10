# Frontend Implementation: NatLang Extension mechanics

The NatLang extension is the VS Code-facing runtime for the product. It manages selection capture, streaming generation, editor edits, the sidebar dashboard, and the bridge into the Java backend.

## Extension architecture

The extension is built around a few cooperating managers:

- `TranspilerEngine` owns provider selection, streaming cleanup, history, and generation state.
- `LiveGenerationManager` drives the live preview mode.
- `SidePanelProvider` hosts the webview dashboard and message bridge.
- `StatusBarManager` reflects idle, generating, success, and error states.
- `AgenticBackendClient` calls the Java backend for optimization and analysis.

The important design rule is that editor streaming stays responsive while slower work such as backend optimization runs in the background.

## Selection and generation flow

The main `NatLang: Generate Code` command follows this pattern:

1. Resolve the source range from the active selection, a NatLang block, or the current line.
2. Build the pseudocode prompt and target language.
3. Ask the active AI provider to stream code tokens.
4. Insert cleaned code into the editor incrementally.
5. Reconcile the streamed draft with the final cleaned output.
6. Push generation metadata to the sidebar and history store.

The streaming path deliberately keeps the editor updated line by line so the user sees live progress instead of waiting for a single final payload.

## Streaming cleanup

NatLang uses a cleanup layer before tokens are inserted into the document. That layer strips conversational preambles, normalizes escaped characters, and prevents obviously empty or malformed fragments from reaching the editor.

The cleanup logic matters because provider output is not always formatted as source code even when the prompt asks for code only.

## Provider integration

### AIProvider interface

Every frontend provider implements a common interface that exposes:

- `generate(system, user, onToken)`
- `isConfigured()`
- `getName()`
- `getModel()`

This keeps Ollama, Anthropic, Gemini, Groq, and OpenAI on the same integration surface.

### Current provider behavior

- Ollama is treated as the local option.
- Cloud providers use secret-backed credentials.
- Provider names in the UI map to backend provider names when the agentic pipeline is invoked.

## API key management

The `NatLang: Set API Key` command now does more than store a secret.

### What happens now

1. The key is normalized by trimming whitespace and stripping surrounding quotes.
2. The extension stores the key in VS Code SecretStorage.
3. The extension writes the same key into `backend/natlang-x-backend/src/main/resources/application-local.properties` for the matching backend provider.
4. The user is prompted to restart the backend.

This closes the gap between frontend credentials and the Java backend so the agentic pipeline can use the same provider without manual duplication.

### Supported providers

- Anthropic
- Gemini
- Groq
- OpenAI

The local backend override file is only updated for those providers because they are the ones that require keys.

## Backend bridge

`AgenticBackendClient` is the extension-to-backend HTTP wrapper. It calls the backend process endpoint and handles dictionary sync and provider health retrieval.

### Supported backend calls

- `POST /api/process` for agentic generation and optimization.
- `POST /api/dictionary/ingest` to push learned mappings.
- `GET /api/dictionary` to refresh the local cache.
- `GET /api/providers/runtime` when available, with a fallback to basic health status.

### Error handling

Backend errors are parsed into friendly messages where possible. If the backend returns structured JSON, the client surfaces the detail field instead of only the HTTP code.

## Sidebar and messaging

The sidebar webview acts as a runtime dashboard. The extension pushes:

- progress updates,
- provider runtime state,
- token streaming updates,
- generation completion markers,
- error notifications,
- live preview state changes.

In the other direction, the webview can request language changes, provider changes, and manual actions such as generation or credential entry.

## Live generation

Live preview is treated as a separate mode from the standard generate command.

- The extension can open a NatLang file automatically when live generation is enabled.
- The live preview follows the selected language.
- Generation is bounded by debounce and retry settings so the editor is not overwhelmed by rapid typing.

## Commands worth knowing

- `NatLang: Generate Code`
- `NatLang: Toggle Live Generation Preview`
- `NatLang: Set API Key`
- `NatLang: Save Generated Code`
- `NatLang: Run Generated Code`
- `NatLang: Change Language`
- `NatLang: Open Policy File`
- `NatLang: Validate Current File Policy`
- `NatLang: Begin Transaction`
- `NatLang: Commit Transaction`
- `NatLang: Rollback Transaction`
- `NatLang: Recover Transaction`

## Operational implications of the recent changes

The frontend now owns the credential synchronization story instead of treating the backend as a separate manual setup step. That makes the extension more usable in a local development workspace, but it also means the backend local override file is part of the operational contract and should be treated carefully.

## Related docs

- [Configuration & Operations](configuration-and-operations.md)
- [Backend Implementation](backend-implementation.md)
- [Advanced Java Concepts](java-concepts.md)
