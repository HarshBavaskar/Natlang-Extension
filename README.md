# NatLang: The Intelligence-Driven Transpilation Engine (v1.1)

NatLang is a professional-grade Visual Studio Code extension designed to bridge the gap between natural language logic and production-ready implementation. By treating pseudocode as a first-class citizen, NatLang enables developers to architect systems using plain English while the underlying engine handles the complexities of syntax, idioms, and multi-language transpilation.

---

## Core Philosophy

Traditional AI assistants often generate code based on localized completion patterns. NatLang shifts this paradigm by utilizing a dedicated Transpilation Engine that processes logical intent into functional code across more than 30 programming environments. This ensures that the generated output is not just syntactically correct, but architecturally sound and idiomatic to the target environment.

## Principal Features

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

### Multi-Model Versatility
NatLang is model-agnostic, supporting a wide array of state-of-the-art LLMs:
- **Anthropic**: Claude 3.5 Sonnet (Optimized for complex reasoning).
- **Google**: Gemini 1.5 Pro and Flash (High-speed, multi-modal processing).
- **OpenAI**: GPT-4o and GPT-3.5 Turbo (Industry-standard performance).
- **Ollama**: Local execution for privacy-conscious development (CodeLlama, DeepSeek-Coder, Starcoder2).

---

## System Architecture

The extension is built on a modular, interface-driven architecture to ensure stability and extensibility.

### 1. Transpiler Engine
The central hub for all operations. It manages the lifecycle of a generation request, including:
- History persistence and context management.
- Real-time token stripping to ensure clean code output.
- Concurrency control for simultaneous editor and sidebar updates.

### 2. Prompt Engineering Layer
A sophisticated Prompt Builder constructs multi-layered instructions that define the boundaries for the AI. This prevents conversational preamble and enforces strict adherence to the target language's best practices.

### 3. Provider Interface
A standardized interface that allows for the rapid integration of new AI models. Each provider handles its own authentication, streaming protocol (SSE, JSON chunking), and error recovery logic.

---

## Getting Started

### Prerequisites
- Visual Studio Code v1.80.0 or higher.
- For local execution: [Ollama](https://ollama.com) installed and running.
- For cloud execution: Valid API keys for Anthropic, Google Gemini, or OpenAI.
- For Agentic Pipeline: Java Runtime Environment (JRE) 17 or higher.

### Installation
1. Search for **NatLang** in the VS Code Marketplace.
2. Click **Install**.
3. Reload VS Code if prompted.

### Local Configuration (Ollama)
1. Ensure the Ollama service is active: `ollama serve`.
2. Pull a coding model: `ollama pull codellama`.
3. NatLang will connect to the default endpoint (`http://localhost:11434`) automatically.

### Cloud Configuration
1. Open the Command Palette (`Ctrl+Shift+P`).
2. Run `NatLang: Set API Key`.
3. Select your provider and enter your credentials. Keys are stored via the VS Code Secrets API.

---

## Usage and Workflow

### The .nl Format
While NatLang works in any text file, using the `.nl` (Natural Language) extension unlocks optimized syntax highlighting for pseudocode and starter templates.

### Keybindings
- **Generate Code**: `Ctrl+Shift+G` (Cmd+Shift+G on macOS).
- **Change Target Language**: Click the language indicator in the Status Bar.
- **Open Dashboard**: Click the NatLang icon in the Activity Bar.

### Dashboard Operations
The sidebar serves as your command center. Use the tactile button grids to:
1. Select your **Target Architecture** (e.g., React, Rust, Python).
2. Choose your **AI Engine**.
3. Input your logic and click **Generate**.
4. Use the **Insert Controls** to apply the optimized code to your active editor.

---

## Configuration Reference

Customize the extension behavior via User Settings (`settings.json`):

| Setting | Description | Default |
|---------|-------------|---------|
| `natlang.aiProvider` | Primary AI engine for generation | `Ollama` |
| `natlang.defaultLanguage` | The initial target language for new files | `TypeScript` |
| `natlang.ollamaModel` | The specific local model to invoke | `codellama` |
| `natlang.backendBaseUrl` | Endpoint for the Agentic AI Java backend | `http://localhost:8080` |
| `natlang.streamingSpeed` | Adjust the UI update frequency (ms) | `50` |

---

## Supported Ecosystems

NatLang generates idiomatic code for a vast array of environments:
- **Web**: React (JSX/TSX), Vue, Angular, Svelte, TypeScript, CSS3, HTML5.
- **Systems**: Rust, Go, C++, C#, Swift, Kotlin, Java (Spring Boot/Jakarta).
- **Data & Scripting**: Python (FastAPI/Django), Ruby on Rails, PHP, Lua, R.
- **Infrastructure**: SQL (PostgreSQL/MySQL), Bash, PowerShell, Terraform.

---

## Development and Contribution

NatLang is built by and for the developer community. We welcome contributions that improve the engine's accuracy or add support for new providers.

### Local Setup
1. Clone the repository.
2. Run `npm install` to hydrate dependencies.
3. Use `npm run compile` to build the TypeScript source.
4. Press `F5` to launch a Development Host of VS Code with the extension active.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full text.

