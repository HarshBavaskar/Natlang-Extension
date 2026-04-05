# NatLang Wiki: Technical Documentation & Implementation Details

Welcome to the NatLang Wiki. This document provides an in-depth technical overview of the NatLang VS Code extension, covering architecture, customization, and troubleshooting.

## 1. Project Architecture

The NatLang extension follows a modular design to ensure seamless integration and extensibility across different AI providers.

### Core Components

*   **TranspilerEngine.ts**: The central processing hub. It manages history, coordinates between AI providers, and handles the logic for stripping and formatting tokens during streaming.
*   **PromptBuilder.ts**: Constructs multi-layered system and user prompts that provide the AI with specific context about target languages, coding standards, and project structure.
*   **StatusBarManager.ts**: Maintains the real-time status display in the VS Code bottom bar, providing feedback during generation.
*   **SidePanelProvider.ts**: Manages the Webview-based sidebar. It functions as a complete dashboard for target architecture and provider configuration.
*   **CodeLensProvider.ts**: Injects interactive UI elements directly into the editor for block-level code generation.

### AI Implementation Logic

Each AI provider (Ollama, Gemini, OpenAI, Anthropic) implements the `AIProvider` interface. This ensures a consistent generation flow:

1.  **Request Construction**: The `TranspilerEngine` calls the `generate` method with a system prompt and the user's pseudocode.
2.  **Streaming**: Responses are streamed via HTTP/HTTPS chunks. The `TranspilerEngine` processes these chunks as "tokens" and sends them to the editor for real-time typing.
3.  **Post-Processing**: Once the stream is complete, the engine performs a final check to strip any remaining markdown wrappers (like \`\`\` code blocks).

## 2. Supported AI Providers

### Ollama (Local LLMs)
*   **Model Recommendation**: `codellama`, `starcoder2`, or `deepseek-coder`.
*   **Setup**: The extension connects to `http://localhost:11434/api/generate`.
*   **Streaming**: Uses JSON chunking where each line contains a `response` field.

### Anthropic
*   **Model Recommendation**: `claude-3-5-sonnet-20240620`.
*   **Auth**: Requires an `x-api-key` in the headers.
*   **Streaming**: Uses Server-Sent Events (SSE) with `content_block_delta` events.

### Gemini
*   **Model Recommendation**: `gemini-1.5-flash` or `gemini-1.5-pro`.
*   **Auth**: Passed via URL query parameter `key`.
*   **Streaming**: Uses SSE with the `:streamGenerateContent` endpoint.

### OpenAI
*   **Model Recommendation**: `gpt-4o` or `gpt-3.5-turbo`.
*   **Auth**: Uses the standard `Bearer` token in the Authorization header.
*   **Streaming**: Processes the `data: { ... }` SSE stream.

## 3. Keyboard Shortcuts

| Command | Keybinding | Mac Keybinding |
|---------|------------|----------------|
| Generate Code | Ctrl+Shift+G | Cmd+Shift+G |
| Change Language | (Status Bar) | (Status Bar) |
| Save Snippet | (Sidebar) | (Sidebar) |

## 4. Customizing the System Prompt

The instructions given to the AI are defined in `PromptBuilder.ts`. These instructions enforce:
*   No conversational preamble (e.g., "Certainly! Here's your code...").
*   Strict formatting without code block wrappers.
*   The use of language-specific best practices (e.g., using `const` in TypeScript).

## 5. Troubleshooting

### Generation is slow or hanging
*   **Check Provider Status**: Ensure your API key is valid or that Ollama is running (`ollama serve`).
*   **Network Latency**: High latency can impact streaming speed.
*   **Model Size**: Larger models (like GPT-4 or local 70B models) take longer to process than smaller ones.

### Code is wrapped in markdown blocks
*   **Prompt Issue**: The AI ignored the "no markdown" instruction.
*   **Engine Handling**: The `TranspilerEngine` tries to strip these automatically, but if they persist, ensure you are using a model optimized for coding.

### Sidebar UI not loading
*   **View ID Mismatch**: Ensure `natlang-explorer` is correctly defined in `package.json`.
*   **Webview Content**: Check the VS Code Developer Tools console (Help -> Toggle Developer Tools) for any JS errors in the webview.

## 6. Contribution Guide

If you'd like to extend NatLang:
1.  Fork the repository.
2.  Install dependencies: `npm install`.
3.  Compile: `npm run compile`.
4.  Launch in Debug mode (F5) to test your changes.
5.  Ensure all providers are tested before submitting a Pull Request.
