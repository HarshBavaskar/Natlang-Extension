# Deterministic Compiler

NatLang includes a deterministic compiler path for teams that want reproducible output without calling an AI model.

## What it does

The deterministic compiler parses a constrained form of pseudocode into a small AST and emits code for three languages:

- Python
- JavaScript
- TypeScript

It is designed for clarity and repeatability rather than broad natural-language understanding.

## Supported syntax

The compiler recognizes a limited grammar:

- `define a function called ... that takes ...`
- `if ...`
- `else`
- `for each ... in ...`
- `pass`
- `return ...`
- `set|assign|let ... to ...`
- `print ...`
- `call ... with ...`
- `call ... with ... and store in ...`

Anything else is ignored with a warning.

## Emit rules

### Python

Python output uses:

- `def` for functions,
- `if`/`else` blocks,
- `for ... in ...` for loops,
- `pass` for no-op bodies,
- direct assignment and `print(...)` for expressions.

### JavaScript and TypeScript

JS-like output uses:

- `function` declarations,
- `if (...) { ... }`,
- `for (const ...) of ...`,
- `// TODO` placeholders for empty bodies,
- `let` for assignments,
- `console.log(...)` for print.

TypeScript additionally annotates parameters as `any` to keep the emitter simple.

## Dictionary mapping

The deterministic path can be combined with dictionary learning so repeated pseudocode variants are normalized before parsing. That improves the odds that a user’s preferred phrasing maps to the same canonical token every time.

## Testing and baselines

### Self-test

The built-in self-test suite checks that small fixtures still compile to the expected shape. The current tests cover:

- a Python function and return case,
- a JavaScript call case,
- a TypeScript `if` case.

### Benchmark

The benchmark harness runs the same fixtures and records:

- pass/fail counts,
- total duration,
- average time per case,
- emitted outputs for each case.

### Baseline capture

NatLang can capture benchmark outputs into `.natlang/baselines/deterministic-baseline.json` and later compare new runs against that baseline to detect drift.

## Operational behavior

The deterministic compiler is not a generic parser. It is a constrained safety path for a small subset of pseudocode. When the input exceeds its grammar, the extension can still use the AI generation path instead.

## Related docs

- [Sidebar and Commands](sidebar-and-commands.md)
- [Transactions and Migrations](transactions-migrations-plugins.md)
- [Dictionary Learning](dictionary-learning.md)
