# Transactions, Migrations, and Plugins

NatLang includes workspace-local tooling that can change code safely, preview modernization packs, and apply custom transforms.

## Transactions

The transaction manager gives NatLang an atomic edit workflow for file changes.

### Lifecycle

1. Begin a transaction for one or more files.
2. Capture the original content before editing.
3. Apply edits.
4. Commit the transaction to keep the new state.
5. Roll back the transaction to restore the previous snapshots.

Transactions persist both in extension state and in a journal file under `.natlang/transactions`, which makes them recoverable after a restart.

### Recovery

If NatLang finds an unfinished transaction when it activates, it prompts you to roll back or keep the recovered state.

## Migration packs

Migration packs are language-specific modernization recipes.

### Supported packs

- `javascript-modernize`
- `typescript-modernize`
- `java-modernize`
- `python-modernize`

### What they do

- JavaScript and TypeScript packs replace `var` with `let`, tighten equality, and apply simple modern syntax cleanup.
- The Java pack replaces older container and string APIs with more modern equivalents and removes `System.gc()` calls.
- The Python pack modernizes older loop and print syntax.

### Risk scoring

Every migration result includes:

- applied transform list,
- changed line count,
- risk score,
- risk level (`low`, `medium`, or `high`).

That makes the preview step meaningful before a migration is actually applied.

## Plugins

NatLang plugins are JSON-defined regex transforms stored under `.natlang/plugins`.

### Stages

- `preParse` transforms run before deterministic parsing.
- `postEmit` transforms run after deterministic emission.

### Sample plugin

The scaffolder writes a sample plugin that normalizes `equals` to `==` before parse and trims trailing whitespace after emit.

## Why this subsystem exists

Transactions, migrations, and plugins are the “workspace surgery” tools in NatLang. They let you make changes that are:

- reversible,
- previewable,
- auditable,
- and customizable.

## Related docs

- [Deterministic Compiler](deterministic-compiler.md)
- [Policy and Governance](policy-governance.md)
- [Sidebar and Commands](sidebar-and-commands.md)
