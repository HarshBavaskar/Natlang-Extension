<p align="center">
  <img src="resources/logo.svg" alt="NatLang Logo" width="120" />
</p>

# NatLang: The Intelligence-Driven Transpilation Engine (v1.1)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/release/HarshBavaskar/natlang-vscode.svg)](https://github.com/HarshBavaskar/natlang-vscode/releases)
[![Build Status](https://img.shields.io/badge/status-stable-success.svg)](https://github.com/HarshBavaskar/natlang-vscode)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Followers](https://img.shields.io/github/followers/HarshBavaskar?style=social)](https://github.com/HarshBavaskar)

NatLang is a professional-grade Visual Studio Code extension designed to bridge the gap between natural language logic and production-ready implementation. By treating pseudocode as a first-class citizen, NatLang enables developers to architect systems using plain English while the underlying engine handles the complexities of syntax, idioms, and multi-language transpilation.

---

## <img src="resources/icons/architecture.svg" height="24" /> Technical Ecosystem (Stack)

NatLang is built on a high-performance, distributed architecture ensuring stability and speed.

- **Frontend/Extension**: TypeScript with VS Code API and a Webview-driven Modern Dashboard.
- **Transpilation Engine**: Interface-driven logic supporting SSE (Server-Sent Events) and JSON streaming.
- **Backend (Agentic AI)**: Java-based orchestration for deep code analysis and logical validation.
- **AI Core**: Native multi-provider support:
    - **Local**: Ollama (CodeLlama, DeepSeek, Starcoder2).
    - **Cloud**: Anthropic Claude 3.5, Google Gemini 1.5 Pro/Flash, OpenAI GPT-4o.
- **Build & CI**: esbuild, ESLint, GitHub Actions (for deployment).

---

## <img src="resources/icons/ai-pipeline.svg" height="24" /> Core Philosophy

Traditional AI assistants often generate code based on localized completion patterns. NatLang shifts this paradigm by utilizing a dedicated Transpilation Engine that processes logical intent into functional code across more than 30 programming environments. This ensures that the generated output is not just syntactically correct, but architecturally sound and idiomatic to the target environment.

## <img src="resources/icons/ai-pipeline.svg" height="24" /> Principal Features

### Real-time Pulse Streaming
Experience instantaneous feedback with live token streaming. As the AI processes your logic, the code is typed directly into your editor and reflected in the sidebar dashboard, providing a transparent view of the generation process.

### Systems Architecture Dashboard
The integrated sidebar provides a high-fidelity interface for managing your AI orchestration. 
- **Target Selection**: Quickly switch between programming languages and frameworks.
- **Provider Management**: Toggle between local LLMs (Ollama) and cloud-based hyper-scalers (Gemini, Anthropic, OpenAI).
- **Processing Monitor**: Track real-time metadata including complexity analysis and generation progress.

### Agentic AI Pipeline
Beyond simple generation, NatLang offers an advanced Agentic Pipeline powered by a high-performance Java backend. This secondary channel provides:
- **Logical Validation**: Analyzes the generated code for structural integrity.
- **Complexity Metrics**: Real-time evaluation of code modularity and performance.
- **Optimization Suggestions**: Automated refactoring recommendations for improved efficiency.
- **Project-Wide Context**: Deeper integration with your existing codebase for coherent expansion.

---

## <img src="resources/icons/architecture.svg" height="24" /> System Architecture

```mermaid
graph TD
    A[VS Code Editor] <-> B[Transpiler Engine]
    B <-> C[AI Providers Manager]
    B <-> D[Agentic Pipeline - Java Backend]
    C <-> E[Ollama / Local]
    C <-> F[Claude / Gemini / GPT]
    D <-> G[Analysis & Validation]
```

The extension is built on a modular, interface-driven architecture to ensure stability and extensibility.

### 1. Transpiler Engine
The central hub for all operations. It manages the lifecycle of a generation request, including:
- History persistence and context management.
- Real-time token stripping to ensure clean code output.
- Concurrency control for simultaneous editor and sidebar updates.

---

## <img src="resources/icons/setup.svg" height="24" /> Getting Started

### Prerequisites
- Visual Studio Code v1.80.0 or higher.
- For local execution: [Ollama](https://ollama.com) installed and running.
- For Agentic Pipeline: Java Runtime Environment (JRE) 17 or higher.

### Installation
1. Search for **NatLang** in the VS Code Marketplace.
2. Click **Install**.
3. Open the Dashboard using the NatLang icon in the Activity Bar.

---

## <img src="resources/icons/faq.svg" height="24" /> Configuration Reference

| Setting | Description | Default |
|---------|-------------|---------|
| `natlang.aiProvider` | Primary AI engine for generation | `Ollama` |
| `natlang.defaultLanguage` | The initial target language | `TypeScript` |
| `natlang.ollamaModel` | The local model to invoke | `codellama` |
| `natlang.backendBaseUrl` | Endpoint for the Agentic AI API | `http://localhost:8080` |

---

## <img src="resources/icons/contribution.svg" height="24" /> Lead Developer & Project Architect

**Harsh Bavaskar** ([@HarshBavaskar](https://github.com/HarshBavaskar))
Main contributor and architect of the NatLang Transpilation Engine.

---

## <img src="resources/icons/errors.svg" height="24" /> License

---

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

