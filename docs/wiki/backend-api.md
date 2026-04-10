# Backend API Reference

This page summarizes the backend endpoints that the extension and external tools use.

## Core process endpoint

### `POST /api/process`

Runs the agentic pipeline.

Typical request fields:

- `userId`
- `action`
- `prompt`
- `code`
- `language`
- `provider`
- `projectContext`

Typical response fields:

- `finalCode`
- `optimizedCode`
- `timeComplexity`
- `spaceComplexity`
- `explanation`
- `suggestions`
- `topic`
- `steps`
- `decisionLog`

The response is created after the backend has run generation, analysis, optimization, and explanation steps as needed.

## Dictionary endpoints

- `POST /api/dictionary/ingest` accepts a list of learned entries and merges them into the backend store.
- `GET /api/dictionary` returns the current dictionary entries.

## History endpoints

- `GET /api/history` returns transpilation history.
- `POST /api/transpilations` creates a stored record.
- `GET /api/transpilations` lists stored records.
- `GET /api/transpilations/{id}` reads one record.
- `PUT /api/transpilations/{id}` updates one record.
- `DELETE /api/transpilations/{id}` removes one record.
- `DELETE /api/{id}` also deletes a history record through the older route alias.

## Provider runtime endpoints

- `GET /api/providers/health` returns a compact health view for each configured provider.
- `GET /api/providers/runtime` returns provider name, model, configuration state, reachability, detail text, and usage summary.

## User endpoints

- `POST /api/users`
- `GET /api/users`
- `GET /api/users/{id}`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`
- `POST /api/users/login`

## Error behavior

The backend uses a global exception handler to turn failures into structured HTTP responses. The extension’s client layer reads the detail text when it is available so the UI can show a more useful message than a raw status code.

## Related docs

- [Backend Implementation](backend-implementation.md)
- [Configuration & Operations](configuration-and-operations.md)
- [Frontend Implementation](frontend-implementation.md)
