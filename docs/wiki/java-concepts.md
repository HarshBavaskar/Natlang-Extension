# Java 21 & Spring Boot 3 in NatLang X

This page describes the Java and Spring Boot patterns that matter in the NatLang X backend. The goal is not to showcase every modern Java feature, but to explain the implementation choices that keep the service predictable and maintainable.

## Java-side patterns that show up in the codebase

### Constructor injection

Backend components are wired through constructor injection rather than field injection. This keeps dependencies explicit and makes the orchestration code easy to test in isolation.

### Locale-safe string handling

The agent pipeline normalizes provider and action names with `Locale.ROOT` before comparison. That avoids platform-dependent casing issues when routing provider work or interpreting actions such as `auto`, `optimize`, `summarize`, and `better`.

### Collection-driven orchestration

The backend keeps its provider list in memory and iterates over it to resolve the requested provider or locate the heuristic fallback provider. This makes provider selection data-driven rather than hardcoding provider branches in multiple places.

### Defensive fallback logic

The Java code uses try/catch blocks around provider-dependent tool execution so that a failed model call can fall back to a heuristic provider when available. That pattern is repeated for generation, optimization, explanation, and the specialized summarize/better paths.

### Immutable response assembly

Responses are assembled step by step, but the final contract is fully populated before returning to the controller. This keeps the API stable and predictable for the extension client.

## Spring Boot patterns

### Component scanning and stereotypes

The backend uses standard Spring stereotypes such as `@Component` and service/controller annotations so the runtime can wire the pipeline automatically.

### Optional local overrides

`spring.config.import=optional:classpath:application-local.properties` lets the backend import workspace-local overrides without making them mandatory. That pattern is useful when the extension writes provider keys into a local file during development.

### Explicit HTTP contract

The extension expects structured JSON responses from the backend. The Java service therefore keeps the API contract narrow and stable, which reduces the amount of parsing logic needed on the TypeScript side.

## Operational implications

The most important Java-side behavior for NatLang is resilience. When a provider fails, the backend does not immediately stop the pipeline if another provider can answer the same request. That keeps the experience usable in mixed local/cloud setups.

## Related docs

- [Configuration & Operations](configuration-and-operations.md)
- [Backend Implementation](backend-implementation.md)
- [Frontend Implementation](frontend-implementation.md)
