<p align="center">
  <img src="resources/logo.svg" alt="NatLang Logo" width="100" />
</p>

# NatLang Wiki: Technical Documentation & Implementation Details

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/HarshBavaskar/natlang-vscode/graphs/commit-activity)

Welcome to the NatLang Wiki. This document provides an in-depth technical overview of the NatLang VS Code extension, covering architecture, customization, and troubleshooting.

## <img src="resources/icons/architecture.svg" height="24" /> Project Architecture

The NatLang extension follows a modular, interface-driven design.

```mermaid
sequenceDiagram
    participant U as User (Pseudo-code)
    participant E as Editor (VS Code)
    participant T as Transpiler Engine
    participant P as AI Provider (Ollama/Claude/GPT)
    participant B as Agentic Backend (Java)

    U->>E: ctrl+shift+g
    E->>T: Request Transpilation
    T->>P: Stream Logic
    P-->>T: Token Stream
    T-->>E: Types directly into editor
    T->>B: Post-generation validation
    B-->>T: Complexity & Optimization metrics
    T-->>E: Update Dashboard Metadata
```

### Core Components

*   **TranspilerEngine.ts**: The central processing hub. It manages history, coordinates between AI providers, and handles the logic for stripping and formatting tokens during streaming.
*   **PromptBuilder.ts**: Constructs multi-layered system and user prompts that provide the AI with specific context about target languages, coding standards, and project structure.
*   **SidePanelProvider.ts**: Manages the Webview-based sidebar. It functions as a complete dashboard for target architecture and provider configuration.
*   **Agentic Orchestrator**: Interfaces with the Java backend to provide secondary validation and optimization.

---

## <img src="resources/icons/ai-pipeline.svg" height="24" /> Agentic AI Pipeline (Java Backend)

The Agentic Pipeline is what sets NatLang apart from standard AI assistants. It doesn't just generate; it validates.

### Technical Specification
- **Engine**: Spring Boot / Jakarta EE compatible.
- **Port**: 8080 (Configurable).
- **Functionality**:
    - **AST Analysis**: Parses generated code to ensure logical consistency.
    - **Cyclomatic Complexity**: Measures code modularity.
    - **Idiomatic Score**: Ranks how well the code follows target language standards.

---

## <img src="resources/icons/providers.svg" height="24" /> Supported AI Providers

| Provider | Mechanism | Recommended Model |
|----------|-----------|------------------|
| **Ollama** | Local HTTP (11434) | `codellama`, `deepseek-coder` |
| **Anthropic** | SSE / Content Block Delta | `claude-3-5-sonnet` |
| **Gemini** | SSE / streamGenerateContent | `gemini-1.5-pro` |
| **OpenAI** | SSE / data chunks | `gpt-4o` |

---

## <img src="resources/icons/faq.svg" height="24" /> FAQ & Troubleshooting

### Q: Why is my code wrapped in ``` backticks?
**A:** This happens if the AI model ignores the system prompt. NatLang's `TranspilerEngine` has a token-stripping regex, but minor inconsistencies can occur with smaller local models. Switch to a "Coder" specific model for best results.

### Q: "NatLang failed to connect to backend"
**A:** Ensure your `natlang.backendBaseUrl` is correct and the Java Agentic AI service is running. If you aren't using the agentic features, you can ignore this warning or disable it in settings.

### Q: How do I add a new language?
**A:** Language support is dynamic. The `PromptBuilder` uses the `targetLanguage` state to set the context. You can select any language from the Dashboard dropdown.

---

## <img src="resources/icons/errors.svg" height="24" /> Common Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `NL-401` | Unauthorized | Check your API Key in `NatLang: Set API Key` |
| `NL-503` | Provider Offline | Ensure Ollama is running or check internet connection |
| `NL-PARSE-ERR` | Logic Mismatch | The pseudo-code was too ambiguous for the engine. |

---

## <img src="resources/icons/contribution.svg" height="24" /> Contribution Guide

If you'd like to extend NatLang:
1.  Fork the repository.
2.  Install dependencies: `npm install`.
3.  Compile: `npm run compile`.
4.  Launch in Debug mode (F5).
