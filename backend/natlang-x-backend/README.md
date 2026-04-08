# NatLang X Backend

Production-grade Spring Boot + JDBC backend for NatLang extension.

## Stack
- Java 21
- Spring Boot 3
- Maven
- MySQL
- JDBC (manual SQL only)

## Run
1. Create MySQL schema using `src/main/resources/sql/schema.sql`.
2. Load sample data from `src/main/resources/sql/sample_data.sql`.
3. Configure DB credentials using environment variables or `src/main/resources/application.properties`.
4. Start:

```bash
mvn spring-boot:run
```

### Windows PowerShell quick start

Set credentials for your MySQL Workbench user in the same terminal before running:

1. `$env:NATLANGX_DB_URL = "jdbc:mysql://localhost:3306/natlangx?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"`
2. `$env:NATLANGX_DB_USERNAME = "your_mysql_username"`
3. `$env:NATLANGX_DB_PASSWORD = "your_mysql_password"`
4. `mvn spring-boot:run`

### Ollama default model

The backend defaults to `llama3:latest` for Ollama. If you want a different local model, set `NATLANGX_OLLAMA_MODEL` before starting the backend.

## Core API
- `POST /api/users`
- `GET /api/users`
- `PUT /api/users/{id}`
- `DELETE /api/users/{id}`
- `POST /api/users/login`
- `POST /api/process`
- `POST /api/dictionary/ingest`
- `GET /api/dictionary`
- `GET /api/history`
- `DELETE /api/{id}`
- `GET /api/search`
- `POST /api/transpilations`
- `GET /api/transpilations`
- `GET /api/transpilations/{id}`
- `PUT /api/transpilations/{id}`
- `DELETE /api/transpilations/{id}`

## Example Agent Request
```json
{
  "userId": 1,
  "prompt": "optimize this code",
  "code": "for(int i=0;i<n;i++){ for(int j=0;j<n;j++){} }",
  "language": "Java",
  "provider": "openai",
  "projectContext": "Contains nested loops and TODO markers"
}
```

## Example Agent Response
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
  "decisionLog": "Agent chose optimize-first pipeline"
}
```
