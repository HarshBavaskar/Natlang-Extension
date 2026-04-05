# Contributing to NatLang

Thank you for your interest in contributing to NatLang! This guide will help you get started with development and outline the process for submitting changes.

## Development Setup

### Prerequisites

*   **Node.js**: Version 18.x or higher.
*   **VS Code**: The latest stable version.
*   **Ollama**: (Optional) For local testing.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/HarshBavaskar/natlang-vscode.git
    cd natlang-vscode
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Open the project in VS Code:
    ```bash
    code .
    ```

### Running the Extension

1.  Press **F5** or go to the "Run and Debug" view and click **Run Extension**.
2.  A new "Extension Development Host" window will open.
3.  Open a `.nl` file and try generating code to verify the setup.

## Code Standards

*   **TypeScript**: Use strong typing for all functions and parameters.
*   **Provider Pattern**: Any new AI provider must implement the `AIProvider` interface.
*   **No Emojis in Commit Messages**: Keep commit messages professional and descriptive.
*   **Linting**: Run `npm run lint` before submitting a PR to ensure consistent styling.

## Submission Process

1.  Create a new branch for your feature or fix.
2.  Commit your changes following the [Conventional Commits](https://www.conventionalcommits.org/) standard.
3.  Push to your fork and open a Pull Request.
4.  Provide a clear description of the change and any relevant issue numbers.

## Reporting Bugs

Please use the [GitHub Issues](https://github.com/HarshBavaskar/natlang-vscode/issues) tracker to report bugs. Include:
*   Your OS and VS Code version.
*   Steps to reproduce the error.
*   The AI provider and model you were using.
*   Any error messages from the "NatLang" output channel or the Developer Tools console.

---

By contributing, you agree that your contributions will be licensed under the MIT License.
