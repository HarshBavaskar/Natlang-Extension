# Dictionary Learning

NatLang learns recurring pseudocode patterns and canonical tokens so both the deterministic compiler and the AI-driven generation path can converge on the same vocabulary.

## What the dictionary is

The dictionary is a mapping between a user’s phrasing and the canonical terms NatLang prefers internally. It is stored locally in extension state and can also be pushed to the backend database.

## Learning sources

NatLang learns from two kinds of signals:

- AI-generated output pairs collected after successful generation,
- workspace corpus scans that look for repeated pseudocode terms and structural hints.

## Canonical terms

The current canonical tokens are intentionally simple and cover the most common pseudocode vocabulary, such as:

- `if`
- `else`
- `for each`
- `return`
- `assign`
- `print`
- `call`
- `function`
- `pass`
- `is empty`
- `not empty`
- comparison operators like greater than, less than, equal to, and not equal to

## Where the data goes

The extension stores learned mappings in globalState for immediate reuse. It also tries to ingest them into the backend’s dictionary endpoints so the Java service has access to the same learned vocabulary.

## Refresh flow

The `Refresh Dictionary From Backend` command replaces the local cache with the backend’s current dictionary view. That is useful when the backend was trained elsewhere or when you want to resynchronize a workspace after a restart.

## Operational note

Dictionary learning is best effort. If backend ingestion fails, the extension keeps the local cache so the current session still benefits from what it learned.

## Related docs

- [Deterministic Compiler](deterministic-compiler.md)
- [Frontend Implementation](frontend-implementation.md)
- [Backend API Reference](backend-api.md)
