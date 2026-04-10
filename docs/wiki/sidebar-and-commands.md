# Sidebar and Commands

This page documents the user-facing controls exposed by the extension: the activity bar view, the sidebar dashboard, CodeLens, status bar updates, and the command set.

## Sidebar layout

The NatLang sidebar is the main control surface for interactive use. It includes:

- AI model selection buttons,
- target language buttons,
- live preview toggle,
- provider runtime panel,
- agentic action buttons,
- optimized code and explanation sections,
- history and selection state,
- progress and usage indicators.

The sidebar is driven by `SidePanelProvider`, which owns both the HTML shell and the message bridge back into the extension.

## Message flow

The sidebar can ask the extension to:

- change the target language,
- change the active provider,
- toggle live preview,
- set an API key,
- insert generated code,
- copy code,
- save code,
- run code,
- launch an agentic backend request,
- refresh provider runtime information.

The extension sends the sidebar:

- token stream updates,
- final generation output,
- agentic results,
- runtime provider status,
- history updates,
- error messages,
- live preview state.

## CodeLens

NatLang injects CodeLens actions above relevant pseudocode blocks in `.nl` files. These are intended to provide a quick way to run generation or adjacent actions without opening the sidebar first.

## Status bar

The status bar reflects the current language and provider, plus generation state. It moves through idle, generating, success, and error modes so the user can tell whether the extension is working or waiting.

## Command catalog

### Core generation

- `NatLang: Generate Code`
- `NatLang: Toggle Live Generation Preview`
- `NatLang: Change Language`
- `NatLang: Set API Key`
- `NatLang: Save Generated Code`
- `NatLang: Run Generated Code`
- `NatLang: Copy Generated Code`
- `NatLang: Open Side Panel`
- `NatLang: New NatLang File`
- `NatLang: Clear History`

### Deterministic tooling

- `NatLang: Compile Deterministic`
- `NatLang: Run Deterministic Self-Test`
- `NatLang: Show Deterministic AST Diff`
- `NatLang: Run Deterministic Benchmark`
- `NatLang: Capture Deterministic Baseline`
- `NatLang: Detect Deterministic Drift`

### Policy and governance

- `NatLang: Open Policy File`
- `NatLang: Validate Current File Policy`
- `NatLang: Lock Policy Pack`
- `NatLang: Verify Policy Pack`
- `NatLang: Switch Policy Profile`
- `NatLang: Install Pre-Commit Policy Hook`
- `NatLang: Configure Owner Approvals`
- `NatLang: Scaffold Rule Plugin`

### Transactions and migrations

- `NatLang: Begin Transaction`
- `NatLang: Commit Transaction`
- `NatLang: Rollback Transaction`
- `NatLang: Recover Transaction`
- `NatLang: Run Migration Pack`
- `NatLang: Preview Migration Pack`

### Dictionary and backend sync

- `NatLang: Scrape Dictionary (AI + Heuristics)`
- `NatLang: Refresh Dictionary From Backend`

## Keyboard shortcuts

The primary keyboard shortcut is:

- `Ctrl+Shift+G` on Windows and Linux
- `Cmd+Shift+G` on macOS

It triggers generation for the current selection or the current NatLang block.

## Related docs

- [Frontend Implementation](frontend-implementation.md)
- [Deterministic Compiler](deterministic-compiler.md)
- [Policy and Governance](policy-governance.md)
