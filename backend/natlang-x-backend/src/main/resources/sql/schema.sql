CREATE DATABASE IF NOT EXISTS natlangx;
USE natlangx;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS transpilations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    prompt TEXT,
    generated_code TEXT,
    optimized_code TEXT,
    explanation TEXT,
    time_complexity VARCHAR(20),
    space_complexity VARCHAR(20),
    suggestions TEXT,
    topic VARCHAR(100),
    provider VARCHAR(30),
    language VARCHAR(50),
    agent_steps TEXT,
    decision_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transpilation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS optimization_runs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transpilation_id INT,
    user_id INT,
    prompt TEXT,
    source_code TEXT,
    optimized_code TEXT,
    time_complexity VARCHAR(20),
    space_complexity VARCHAR(20),
    topic VARCHAR(100),
    provider VARCHAR(30),
    language VARCHAR(50),
    decision_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_optimization_transpilation FOREIGN KEY (transpilation_id) REFERENCES transpilations(id) ON DELETE SET NULL,
    CONSTRAINT fk_optimization_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS summaries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transpilation_id INT,
    user_id INT,
    prompt TEXT,
    source_code TEXT,
    summary_text TEXT,
    topic VARCHAR(100),
    provider VARCHAR(30),
    language VARCHAR(50),
    decision_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_summary_transpilation FOREIGN KEY (transpilation_id) REFERENCES transpilations(id) ON DELETE SET NULL,
    CONSTRAINT fk_summary_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS better_code_recommendations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transpilation_id INT,
    user_id INT,
    prompt TEXT,
    source_code TEXT,
    recommendations TEXT,
    time_complexity VARCHAR(20),
    space_complexity VARCHAR(20),
    topic VARCHAR(100),
    provider VARCHAR(30),
    language VARCHAR(50),
    decision_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_better_transpilation FOREIGN KEY (transpilation_id) REFERENCES transpilations(id) ON DELETE SET NULL,
    CONSTRAINT fk_better_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS deterministic_dictionary_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    term VARCHAR(255) NOT NULL UNIQUE,
    canonical VARCHAR(255) NOT NULL,
    confidence DOUBLE NOT NULL DEFAULT 0.7,
    source VARCHAR(100) DEFAULT 'unknown',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
