# Java 21 & Spring Boot 3: Advanced Concepts in NatLang X

The NatLang X backend leverage modern **Java 21** features and **Spring Boot 3** patterns to provide a scalable, high-performance agentic engine.

## Java 21 Features

### 1. Modern Stream API
The backend uses **Java Streams** throughout its controllers and services for efficient, declarative data processing.
- **Example**: `providers.stream().map(AIProvider::health).toList()` provides a clean, zero-boilerplate health check across the entire provider ecosystem.

### 2. Records & DTOs (Data Transfer Objects)
- **Benefit**: Reduced boilerplate for data-centric classes.
- **Usage**: Every request (`ProcessRequest`) and response (`AgentResponse`) between the extension and the backend is modeled using records (or Lombok-enhanced classes) to ensure immutability and technical clarity.

### 3. Pattern Matching (Switch Expressions)
- **Implementation**: Used for provider resolution and complex error handling logic, ensuring that exhaustive checks are performed during development.

---

## Spring Boot 3 Patterns

### 1. Constructor-Based Dependency Injection
We strictly use **Constructor Injection** for all services and controllers.
- **Why?**: It ensures that dependencies are immutable and available at instantiation time, preventing `NullPointerException` issues during unit testing.

### 2. Jakarta Persistence & Beans Validation
- **Usage**: The `@Valid` annotation on Controller endpoints ensures that payloads are structurally correct before any agentic logic is executed.
- **JDBC Persistence**: Custom row mappers and optimized SQL queries minimize the overhead of database interactions.

### 3. RestController with Global Exception Handling
- **Pattern**: A unified exception handler transforms Java errors into high-level terminal error codes (e.g., `NL-401`, `NL-503`) for the extension to display.

---

## Logic Patterns

### 1. Agentic Tool Orchestration
The "Agentic" logic revolves around **Tool-Driven Analysis**. Instead of a single AI call, the backend can orchestrate multiple tools (AST Parser, Complexity Evaluator) and merge their findings.

### 2. Project Context Analytics
- **Implementation**: The backend analyzes "Context Blobs" sent from the extension to provide more coherent optimization suggestions based on the project's specific coding style and existing class structures.

> [!IMPORTANT]
> The use of **Java 21 Virtual Threads** (Project Loom) is currently being explored for the next release to further improve the throughput of simultaneous AI provider requests.
