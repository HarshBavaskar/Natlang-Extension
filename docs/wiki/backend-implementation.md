# Backend Implementation: NatLang X Engine

The NatLang X Backend is a production-grade **Java 21** and **Spring Boot 3** service designed for high-performance agentic reasoning and code optimization.

## 3-Layer Architecture

The backend follows a strict **Clean Architecture** pattern to ensure separation of concerns and testability.

### 1. Controller Layer (`com.natlangx.controller`)
- **Responsibility**: Exposes REST endpoints and handles HTTP request validation.
- **Key Pattern**: `RestController` with `Jakarta Validation`.
- **Primary Endpoint**: `POST /api/process` - Processes a `ProcessRequest` and returns an `AgentResponse`.

### 2. Service Layer (`com.natlangx.service`)
- **Responsibility**: Contains the core business logic and orchestrates the "Agentic" cycle.
- **Key Pattern**: `AgentService` handles the complex logic of calling AI providers, parsing results, and persisting the transpilation history.
- **TranspilationService**: Manages the CRUD operations for historical data.

### 3. DAO/Persistence Layer (`com.natlangx.dao`)
- **Responsibility**: Direct interaction with the **MySQL** database.
- **Key Pattern**: **JDBC-First** approach. We avoid heavy ORMs like Hibernate to maintain maximum control over SQL performance and mapping.
- **Schema**: Uses a performance-indexed `transpilation` table.

---

## Agentic Optimization Lifecycle

The `AgentService` implements a "Decision Pipeline" for every request:
1.  **Request Decoration**: Enriches the user prompt with project-wide context.
2.  **AI Orchestration**: Parallelizes calls to AI providers if multiple analyses are needed.
3.  **Metrics Extraction**: Uses regex and structured parsing to extract complexity scores.
4.  **Consolidation**: Merges optimized code, explanations, and decision logs into a unified `AgentResponse`.

---

## Tech Stack & Dependencies

- **Spring Boot 3.x**: Web, Validation, DevTools.
- **Java 21**: Utilizing modern language features for clean code.
- **MySQL Driver**: High-speed JDBC connectivity.
- **Lombok**: Reduced boilerplate for DTOs and Models.

> [!NOTE]
> The backend is designed to be **Stateless**. Scaling the engine is as simple as launching more instances behind a load balancer, as all state is persisted in MySQL.
