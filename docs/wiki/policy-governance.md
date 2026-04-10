# Policy and Governance

NatLang includes policy and ownership tools for teams that need guardrails around generated or migrated code.

## Policy engine

The policy engine loads JSON policy files from the workspace-local `.natlang/policies` directory.

### Default policy

The default policy is built around a simple safety baseline:

- block `eval(...)`,
- block shell execution APIs such as `Runtime.getRuntime().exec`, `child_process.exec`, and `subprocess.Popen`,
- allow additional required patterns to be configured when a team wants positive enforcement rules.

### Profiles

Policy profiles let you keep multiple policy sets in the same workspace. NatLang stores the active profile in `.natlang/profile.json` and can switch or create profiles from the command palette.

### Locking

A policy lock file stores a hash of the active policy. When the file and lock disagree, NatLang reports a policy integrity issue instead of silently trusting stale policy state.

## Validation flow

When you validate the current file, NatLang:

1. loads the active policy profile,
2. checks for a valid policy lock,
3. tests blocked patterns,
4. tests required patterns,
5. reports violations and warnings in the output channel.

The policy mode controls the final severity:

- `enforce` fails the validation,
- `warn` surfaces problems without blocking the workflow.

## Ownership guardrails

NatLang can read CODEOWNERS-style rules and request approval tokens for guarded files. This is meant for workspaces that need an extra layer of approval before a migration or deterministic change is applied.

## Pre-commit hook

The extension can install a Git hook that validates staged files against the active policy profile before commit.

## Why it matters

The policy system makes NatLang more than a code generator. It gives teams a way to shape what the tool is allowed to produce or change and to keep that control visible in the workspace itself.

## Related docs

- [Sidebar and Commands](sidebar-and-commands.md)
- [Transactions and Migrations](transactions-migrations-plugins.md)
- [Configuration & Operations](configuration-and-operations.md)
