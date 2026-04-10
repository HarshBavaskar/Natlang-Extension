# NatLang X Backend

NatLang X is the Java 21 and Spring Boot 3 backend that powers NatLang's agentic analysis, optimization, and explanation pipeline.

## What it does

- Resolves the requested provider and model.
- Runs the `/api/process` agent pipeline for optimize, summarize, better, and auto modes.
- Persists transpilation history and dictionary data using JDBC.
- Retries provider work with the heuristic provider when the preferred provider fails.

## Stack

- Java 21
- Spring Boot 3
- Maven
- MySQL
- JDBC

## Configuration

`src/main/resources/application.properties` defines the shared defaults, and the backend also imports `application-local.properties` when present.

Common environment variables include:

- `NATLANGX_DB_URL`
- `NATLANGX_DB_USERNAME`
- `NATLANGX_DB_PASSWORD`
- `NATLANGX_OLLAMA_BASE_URL`
- `NATLANGX_OLLAMA_MODEL`
- `NATLANGX_OPENAI_API_KEY`
- `NATLANGX_GROQ_API_KEY`
- `NATLANGX_GEMINI_API_KEY`
- `NATLANGX_ANTHROPIC_API_KEY`

The current checked-in defaults are:

- Ollama model: `gemma3:4b`
- OpenAI model: `gpt-4o-mini`
- Groq model: `openai/gpt-oss-120b`
- Gemini model: `gemini-1.5-flash`
- Anthropic model: `claude-3-5-sonnet-20241022`
- Backend port: `9001`

## Run

1. Create the MySQL schema with `src/main/resources/sql/schema.sql`.
2. Optionally load `src/main/resources/sql/sample_data.sql`.
3. Configure database credentials with environment variables or local overrides.
4. Start the service:

```bash
mvn spring-boot:run
```

### Windows PowerShell quick start

```powershell
$env:NATLANGX_DB_URL = "jdbc:mysql://localhost:3306/natlangx?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
$env:NATLANGX_DB_USERNAME = "your_mysql_username"
$env:NATLANGX_DB_PASSWORD = "your_mysql_password"
mvn spring-boot:run
```

## API surface

- `POST /api/process`
- `POST /api/dictionary/ingest`
- `GET /api/dictionary`
- `GET /api/history`
- `POST /api/transpilations`
- `GET /api/transpilations`
- `GET /api/transpilations/{id}`
- `PUT /api/transpilations/{id}`
- `DELETE /api/transpilations/{id}`
- `POST /api/users/login`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`

## Agent response shape

A typical `/api/process` response includes:

- final and optimized code,
- time and space complexity,
- explanation text when requested,
- merged suggestions,
- topic classification for auto mode,
- pipeline `steps`,
- decision log including the provider that actually answered.

If a provider request fails and the heuristic provider is available, the backend retries and marks the response steps with fallback-specific entries.

## Example request

```json
{
  "userId": 1,
  "action": "optimize",
  "prompt": "reduce the nested loop cost",
  "code": "for(int i=0;i<n;i++){ for(int j=0;j<n;j++){} }",
  "language": "Java",
  "provider": "openai",
  "projectContext": "Contains nested loops and TODO markers"
}
```

## Example response

```json
{
  "finalCode": "public class NatLangOutput { ... }",
  "optimizedCode": "public class NatLangOutput { ... }",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "explanation": "This Java code follows the prompt logic...",
  "suggestions": "Reduce nested loops using hashing. Project suggestions: Resolve TODO/FIXME markers before release.",
  "topic": "Data Structures",
  "steps": ["Generated", "Analyzed", "Optimized", "Explained"],
  "decisionLog": "Agent chose optimize-first pipeline | Provider: openai"
}
```

## Operational note

Restart the backend after changing provider keys so the Java process reloads the local override file written by the extension.
