<p align="center">
  <img src="resources/logo.svg" alt="NatLang Logo" width="128" />
</p>

# NatLang Technical Wiki Portal

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/HarshBavaskar/natlang-vscode)](https://github.com/HarshBavaskar/natlang-vscode/graphs/commit-activity)

This wiki is the authoritative guide to NatLang. It explains the extension, backend, deterministic tooling, policy layer, transactions, migrations, dictionary learning, provider stack, and operational behavior in one place.

## What This Wiki Covers

NatLang is split across a VS Code extension, a Java backend, and a set of workspace-local tooling layers. The wiki documents:

- The generation flow from pseudocode selection to streamed code output.
- The sidebar, CodeLens, status bar, and command system.
- The Java backend agent pipeline and API surface.
- The deterministic compiler and its test/baseline workflow.
- Policy enforcement, ownership checks, and pre-commit hooks.
- Transaction rollback, migration packs, and plugin transforms.
- Dictionary learning and backend sync.
- Provider configuration, API-key propagation, and fallback behavior.

## Reading Map

### Core Guides

- [Configuration & Operations](docs/wiki/configuration-and-operations.md)
- [Frontend Implementation](docs/wiki/frontend-implementation.md)
- [Backend Implementation](docs/wiki/backend-implementation.md)
- [Advanced Java Concepts](docs/wiki/java-concepts.md)

### Feature Reference

- [AI Providers](docs/wiki/ai-providers.md)
- [Sidebar and Commands](docs/wiki/sidebar-and-commands.md)
- [Deterministic Compiler](docs/wiki/deterministic-compiler.md)
- [Policy and Governance](docs/wiki/policy-governance.md)
- [Transactions, Migrations, and Plugins](docs/wiki/transactions-migrations-plugins.md)
- [Dictionary Learning](docs/wiki/dictionary-learning.md)
- [Backend API Reference](docs/wiki/backend-api.md)

## System Map

NatLang works as a layered system:

1. The editor layer captures pseudocode and streams generated code.
2. The UI layer shows provider state, live preview, and agentic results.
3. The backend layer runs analysis, optimization, explanation, and persistence.
4. The deterministic layer compiles a constrained pseudocode grammar without model calls.
5. The governance layer adds policy, ownership, and transaction controls.
6. The dictionary layer learns recurring phrases and improves both paths.

## Key Defaults

- Extension Ollama model: `gemma3:4b`
- Extension default target language: `Python`
- Backend Ollama model: `gemma3:4b`
- Backend port: `9001`
- Supported extension providers: `ollama`, `anthropic`, `gemini`, `groq`, `openai`
- Backend fallback provider: `heuristic`

## Feature Index

### Generation

- The extension streams tokens into the editor as they arrive.
- The prompt builder forces code-only output and Java-specific structure when needed.
- The backend can retry provider work with the heuristic provider when a selected model fails.
- The extension mirrors cloud API keys into backend local config so the Java side can use the same provider without manual duplication.

### Sidebar and Commands

- The sidebar owns language, provider, live preview, and agentic action controls.
- CodeLens entries provide quick actions on `.nl` files.
- The status bar reflects the current language/provider and generation state.
- Commands are grouped by generation, deterministic tooling, policy, transactions, migrations, and dictionary learning.

### Deterministic Tooling

- The deterministic compiler supports Python, JavaScript, and TypeScript.
- It recognizes a small pseudocode grammar for functions, conditions, loops, assignments, print, return, and function calls.
- Self-tests and benchmarks verify output stability.
- Baselines allow drift detection across workspace changes or extension updates.

### Governance

- Policy files live under `.natlang/policies`.
- Active profiles are stored in `.natlang/profile.json`.
- Lock files detect tampering or stale policy state.
- Ownership guardrails can request approval tokens for protected files.
- A Git hook can enforce policy before commit.

### Transactions and Migrations

- Transactions snapshot files before edits and can restore them after failure.
- Migration packs modernize JavaScript, TypeScript, Java, and Python code.
- Plugins apply pre-parse and post-emit regex transforms.
- Migration results include risk score and changed line count.

### Dictionary and Backend Sync

- The extension learns term mappings from successful generations and workspace corpus scans.
- Learned mappings are stored locally and can be ingested into the backend database.
- The backend can return the current dictionary for resynchronization.

## Operational Notes

- When you save a cloud provider key, the extension writes it into `application-local.properties` for the backend as well as SecretStorage.
- The backend should be restarted after key changes so it reloads local overrides.
- Provider runtime information is shown in the sidebar when the backend is reachable.
- The heuristic provider exists to keep the backend usable when a preferred provider is unavailable.
- The deterministic compiler is intentionally narrow; use the AI path for broader pseudocode.

## Suggested Reading Order

If you want to understand NatLang from the ground up, read in this order:

1. [Configuration & Operations](docs/wiki/configuration-and-operations.md)
2. [Frontend Implementation](docs/wiki/frontend-implementation.md)
3. [Sidebar and Commands](docs/wiki/sidebar-and-commands.md)
4. [Backend Implementation](docs/wiki/backend-implementation.md)
5. [Backend API Reference](docs/wiki/backend-api.md)
6. [AI Providers](docs/wiki/ai-providers.md)
7. [Deterministic Compiler](docs/wiki/deterministic-compiler.md)
8. [Policy and Governance](docs/wiki/policy-governance.md)
9. [Transactions, Migrations, and Plugins](docs/wiki/transactions-migrations-plugins.md)
10. [Dictionary Learning](docs/wiki/dictionary-learning.md)

---

> [!NOTE]
> This documentation is maintained by the NatLang core team. If you find an inaccuracy or want a missing feature documented, open an issue or pull request.
