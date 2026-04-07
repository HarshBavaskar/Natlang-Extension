# Frontend Implementation: NatLang Extension mechanics

The NatLang extension is a powerful **TypeScript** application built on the **VS Code API**, providing a high-performance, real-time transpilation dashboard.

## Transpilation Engine (`TranspilerEngine.ts`)

The `TranspilerEngine` is the core orchestrator of the extension. It manages the full lifecycle of a transpilation request.

### 1. SSE (Server-Sent Events) Streaming
- **Implementation**: The engine uses a custom **Streaming Buffer** to handle real-time token delivery.
- **Filtering**: A sophisticated **Regex-based "Preamble Filtering"** logic strips conversational AI noise (e.g., *"Certainly! Here is..."*) in real-time, delivering only functional code to the editor.
- **Efficiency**: Tokens are typed directly into the active editor as they arrive, providing an instantaneous feedback loop.

### 2. History & Persistence
- **Global State**: Transpilation history (last 50 entries) is persisted in `vscode.ExtensionContext.globalState`.
- **Searchable**: Metrics like complexity, topic, and provider are indexed for quick retrieval in the sidebar.

---

## Dashboard & Webview (`SidePanelProvider.ts`)

The **NatLang Sidebar** is a rich, high-fidelity dashboard built with Webview technologies.

### 1. Webview Messaging Protocol
- **Extension to Webview**: Sends real-time updates on transpilation progress, history, and provider health.
- **Webview to Extension**: Communicates user configuration changes (Target Language, AI Provider) and manual trigger requests.
- **Modern UI**: Uses vanilla CSS for a sleek, dark-themed "Systems Architecture" experience.

### 2. CodeLens & Command Integration
- **CodeLenses**: Automatically injects "Improve" and "Analyze" buttons above relevant pseudocode blocks.
- **Key Shortcuts**: `ctrl+shift+g` provides a global entry point to the transpiler.

---

## AI Provider Portfolio (`providers/`)

NatLang uses a strict **Interface-Driven Pattern** for AI connections.

### AIProvider Interface
Every provider must implement:
- `generate(system: string, user: string, onToken: (t: string) => void)`
- `getName(): string`
- `health(): ProviderHealthStatus`

### Current Portfolio
- **Local (Ollama)**: Direct connection to `localhost:11434`. No data leaves the machine.
- **Cloud (Anthropic, Gemini, OpenAI)**: High-speed SSE connections with SECURE secret management (VS Code SecretStorage).

> [!TIP]
> To add a new provider, simply implement the `AIProvider` interface and register it in `TranspilerEngine.getProvider()`.
