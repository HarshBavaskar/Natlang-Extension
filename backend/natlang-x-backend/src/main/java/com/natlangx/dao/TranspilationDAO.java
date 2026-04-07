package com.natlangx.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.natlangx.config.DBConnection;
import com.natlangx.exception.ApiException;
import com.natlangx.model.Transpilation;

@Repository
public class TranspilationDAO {
    private final DBConnection dbConnection;

    public TranspilationDAO(DBConnection dbConnection) {
        this.dbConnection = dbConnection;
    }

    public Transpilation create(Transpilation t) {
        String sql = "INSERT INTO transpilations(user_id, prompt, generated_code, optimized_code, explanation, time_complexity, space_complexity, suggestions, topic, provider, language, agent_steps, decision_log) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            fillUpsertParams(ps, t);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    t.setId(rs.getInt(1));
                }
            }
            return t;
        } catch (SQLException ex) {
            if (isLegacySchemaIssue(ex)) {
                return createLegacy(t);
            }
            throw new ApiException("Failed to create transpilation: " + ex.getMessage(), ex);
        }
    }

    public Optional<Transpilation> findById(int id) {
        String sql = "SELECT * FROM transpilations WHERE id = ?";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapTranspilation(rs));
                }
                return Optional.empty();
            }
        } catch (SQLException ex) {
            throw new ApiException("Failed to fetch transpilation by id", ex);
        }
    }

    public List<Transpilation> findAll() {
        String sql = "SELECT * FROM transpilations ORDER BY created_at DESC";
        List<Transpilation> list = new ArrayList<>();
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                list.add(mapTranspilation(rs));
            }
            return list;
        } catch (SQLException ex) {
            throw new ApiException("Failed to fetch transpilation history", ex);
        }
    }

    public boolean update(int id, Transpilation t) {
        String sql = "UPDATE transpilations SET user_id=?, prompt=?, generated_code=?, optimized_code=?, explanation=?, time_complexity=?, space_complexity=?, suggestions=?, topic=?, provider=?, language=?, agent_steps=?, decision_log=? WHERE id=?";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            fillUpsertParams(ps, t);
            ps.setInt(14, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException ex) {
            if (isLegacySchemaIssue(ex)) {
                return updateLegacy(id, t);
            }
            throw new ApiException("Failed to update transpilation: " + ex.getMessage(), ex);
        }
    }

    public boolean delete(int id) {
        String sql = "DELETE FROM transpilations WHERE id = ?";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException ex) {
            throw new ApiException("Failed to delete transpilation", ex);
        }
    }

    public void createOptimizationRun(Integer transpilationId, Integer userId, String prompt, String sourceCode,
                                      String optimizedCode, String timeComplexity, String spaceComplexity,
                                      String topic, String provider, String language, String decisionLog) {
        String sql = "INSERT INTO optimization_runs(transpilation_id, user_id, prompt, source_code, optimized_code, time_complexity, space_complexity, topic, provider, language, decision_log) VALUES(?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ensureActionTables(conn);
            setNullableInt(ps, 1, transpilationId);
            setNullableInt(ps, 2, userId);
            ps.setString(3, prompt);
            ps.setString(4, sourceCode);
            ps.setString(5, optimizedCode);
            ps.setString(6, timeComplexity);
            ps.setString(7, spaceComplexity);
            ps.setString(8, topic);
            ps.setString(9, provider);
            ps.setString(10, language);
            ps.setString(11, decisionLog);
            ps.executeUpdate();
        } catch (SQLException ex) {
            throw new ApiException("Failed to store optimization run", ex);
        }
    }

    public void createSummaryRecord(Integer transpilationId, Integer userId, String prompt, String sourceCode,
                                    String summaryText, String topic, String provider, String language, String decisionLog) {
        String sql = "INSERT INTO summaries(transpilation_id, user_id, prompt, source_code, summary_text, topic, provider, language, decision_log) VALUES(?,?,?,?,?,?,?,?,?)";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ensureActionTables(conn);
            setNullableInt(ps, 1, transpilationId);
            setNullableInt(ps, 2, userId);
            ps.setString(3, prompt);
            ps.setString(4, sourceCode);
            ps.setString(5, summaryText);
            ps.setString(6, topic);
            ps.setString(7, provider);
            ps.setString(8, language);
            ps.setString(9, decisionLog);
            ps.executeUpdate();
        } catch (SQLException ex) {
            throw new ApiException("Failed to store summary record", ex);
        }
    }

    public void createBetterCodeRecord(Integer transpilationId, Integer userId, String prompt, String sourceCode,
                                       String recommendations, String timeComplexity, String spaceComplexity,
                                       String topic, String provider, String language, String decisionLog) {
        String sql = "INSERT INTO better_code_recommendations(transpilation_id, user_id, prompt, source_code, recommendations, time_complexity, space_complexity, topic, provider, language, decision_log) VALUES(?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ensureActionTables(conn);
            setNullableInt(ps, 1, transpilationId);
            setNullableInt(ps, 2, userId);
            ps.setString(3, prompt);
            ps.setString(4, sourceCode);
            ps.setString(5, recommendations);
            ps.setString(6, timeComplexity);
            ps.setString(7, spaceComplexity);
            ps.setString(8, topic);
            ps.setString(9, provider);
            ps.setString(10, language);
            ps.setString(11, decisionLog);
            ps.executeUpdate();
        } catch (SQLException ex) {
            throw new ApiException("Failed to store better-code record", ex);
        }
    }

    public List<Transpilation> search(String language, String topic, String complexity, String provider) {
        StringBuilder sql = new StringBuilder("SELECT * FROM transpilations WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (language != null && !language.isBlank()) {
            sql.append(" AND language = ?");
            params.add(language);
        }
        if (topic != null && !topic.isBlank()) {
            sql.append(" AND topic = ?");
            params.add(topic);
        }
        if (complexity != null && !complexity.isBlank()) {
            sql.append(" AND time_complexity = ?");
            params.add(complexity);
        }
        if (provider != null && !provider.isBlank()) {
            sql.append(" AND provider = ?");
            params.add(provider);
        }

        sql.append(" ORDER BY created_at DESC");

        List<Transpilation> list = new ArrayList<>();
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapTranspilation(rs));
                }
            }
            return list;
        } catch (SQLException ex) {
            if (isLegacySchemaIssue(ex)) {
                return searchLegacy(language, topic, complexity);
            }
            throw new ApiException("Failed to search transpilation history: " + ex.getMessage(), ex);
        }
    }

    private Transpilation createLegacy(Transpilation t) {
        String sql = "INSERT INTO transpilations(user_id, prompt, generated_code, optimized_code, explanation, time_complexity, space_complexity, suggestions, topic, agent_steps, decision_log) VALUES(?,?,?,?,?,?,?,?,?,?,?)";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            fillLegacyUpsertParams(ps, t);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    t.setId(rs.getInt(1));
                }
            }
            return t;
        } catch (SQLException ex) {
            throw new ApiException("Failed to create transpilation (legacy schema): " + ex.getMessage(), ex);
        }
    }

    private boolean updateLegacy(int id, Transpilation t) {
        String sql = "UPDATE transpilations SET user_id=?, prompt=?, generated_code=?, optimized_code=?, explanation=?, time_complexity=?, space_complexity=?, suggestions=?, topic=?, agent_steps=?, decision_log=? WHERE id=?";
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            fillLegacyUpsertParams(ps, t);
            ps.setInt(12, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException ex) {
            throw new ApiException("Failed to update transpilation (legacy schema): " + ex.getMessage(), ex);
        }
    }

    private List<Transpilation> searchLegacy(String language, String topic, String complexity) {
        StringBuilder sql = new StringBuilder("SELECT * FROM transpilations WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (topic != null && !topic.isBlank()) {
            sql.append(" AND topic = ?");
            params.add(topic);
        }
        if (complexity != null && !complexity.isBlank()) {
            sql.append(" AND time_complexity = ?");
            params.add(complexity);
        }

        // If schema is legacy (no language/provider), ignore those filters gracefully.
        if (language != null && !language.isBlank()) {
            sql.append(" AND 1=1");
        }

        sql.append(" ORDER BY created_at DESC");

        List<Transpilation> list = new ArrayList<>();
        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapTranspilation(rs));
                }
            }
            return list;
        } catch (SQLException ex) {
            throw new ApiException("Failed to search transpilation history (legacy schema): " + ex.getMessage(), ex);
        }
    }

    private void fillUpsertParams(PreparedStatement ps, Transpilation t) throws SQLException {
        if (t.getUserId() == null) {
            ps.setNull(1, java.sql.Types.INTEGER);
        } else {
            ps.setInt(1, t.getUserId());
        }
        ps.setString(2, t.getPrompt());
        ps.setString(3, t.getGeneratedCode());
        ps.setString(4, t.getOptimizedCode());
        ps.setString(5, t.getExplanation());
        ps.setString(6, t.getTimeComplexity());
        ps.setString(7, t.getSpaceComplexity());
        ps.setString(8, t.getSuggestions());
        ps.setString(9, t.getTopic());
        ps.setString(10, t.getProvider());
        ps.setString(11, t.getLanguage());
        ps.setString(12, t.getAgentSteps());
        ps.setString(13, t.getDecisionLog());
    }

    private void fillLegacyUpsertParams(PreparedStatement ps, Transpilation t) throws SQLException {
        if (t.getUserId() == null) {
            ps.setNull(1, java.sql.Types.INTEGER);
        } else {
            ps.setInt(1, t.getUserId());
        }
        ps.setString(2, t.getPrompt());
        ps.setString(3, t.getGeneratedCode());
        ps.setString(4, t.getOptimizedCode());
        ps.setString(5, t.getExplanation());
        ps.setString(6, t.getTimeComplexity());
        ps.setString(7, t.getSpaceComplexity());
        ps.setString(8, t.getSuggestions());
        ps.setString(9, t.getTopic());
        ps.setString(10, t.getAgentSteps());
        ps.setString(11, t.getDecisionLog());
    }

    private void setNullableInt(PreparedStatement ps, int index, Integer value) throws SQLException {
        if (value == null) {
            ps.setNull(index, java.sql.Types.INTEGER);
        } else {
            ps.setInt(index, value);
        }
    }

    private void ensureActionTables(Connection conn) throws SQLException {
        try (Statement statement = conn.createStatement()) {
            statement.execute("CREATE TABLE IF NOT EXISTS optimization_runs ("
                    + "id INT PRIMARY KEY AUTO_INCREMENT,"
                    + "transpilation_id INT,"
                    + "user_id INT,"
                    + "prompt TEXT,"
                    + "source_code TEXT,"
                    + "optimized_code TEXT,"
                    + "time_complexity VARCHAR(20),"
                    + "space_complexity VARCHAR(20),"
                    + "topic VARCHAR(100),"
                    + "provider VARCHAR(30),"
                    + "language VARCHAR(50),"
                    + "decision_log TEXT,"
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    + "CONSTRAINT fk_optimization_transpilation FOREIGN KEY (transpilation_id) REFERENCES transpilations(id) ON DELETE SET NULL,"
                    + "CONSTRAINT fk_optimization_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
                    + ")");

            statement.execute("CREATE TABLE IF NOT EXISTS summaries ("
                    + "id INT PRIMARY KEY AUTO_INCREMENT,"
                    + "transpilation_id INT,"
                    + "user_id INT,"
                    + "prompt TEXT,"
                    + "source_code TEXT,"
                    + "summary_text TEXT,"
                    + "topic VARCHAR(100),"
                    + "provider VARCHAR(30),"
                    + "language VARCHAR(50),"
                    + "decision_log TEXT,"
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    + "CONSTRAINT fk_summary_transpilation FOREIGN KEY (transpilation_id) REFERENCES transpilations(id) ON DELETE SET NULL,"
                    + "CONSTRAINT fk_summary_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
                    + ")");

            statement.execute("CREATE TABLE IF NOT EXISTS better_code_recommendations ("
                    + "id INT PRIMARY KEY AUTO_INCREMENT,"
                    + "transpilation_id INT,"
                    + "user_id INT,"
                    + "prompt TEXT,"
                    + "source_code TEXT,"
                    + "recommendations TEXT,"
                    + "time_complexity VARCHAR(20),"
                    + "space_complexity VARCHAR(20),"
                    + "topic VARCHAR(100),"
                    + "provider VARCHAR(30),"
                    + "language VARCHAR(50),"
                    + "decision_log TEXT,"
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    + "CONSTRAINT fk_better_transpilation FOREIGN KEY (transpilation_id) REFERENCES transpilations(id) ON DELETE SET NULL,"
                    + "CONSTRAINT fk_better_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
                    + ")");
        }
    }

    private boolean isLegacySchemaIssue(SQLException ex) {
        String msg = ex.getMessage();
        if (msg == null) {
            return false;
        }
        String lower = msg.toLowerCase();
        return lower.contains("unknown column") &&
                (lower.contains("provider") || lower.contains("language"));
    }

    private Transpilation mapTranspilation(ResultSet rs) throws SQLException {
        Transpilation t = new Transpilation();
        t.setId(rs.getInt("id"));
        int userId = rs.getInt("user_id");
        t.setUserId(rs.wasNull() ? null : userId);
        t.setPrompt(rs.getString("prompt"));
        t.setGeneratedCode(rs.getString("generated_code"));
        t.setOptimizedCode(rs.getString("optimized_code"));
        t.setExplanation(rs.getString("explanation"));
        t.setTimeComplexity(rs.getString("time_complexity"));
        t.setSpaceComplexity(rs.getString("space_complexity"));
        t.setSuggestions(rs.getString("suggestions"));
        t.setTopic(rs.getString("topic"));
        t.setProvider(readNullableColumn(rs, "provider"));
        t.setLanguage(readNullableColumn(rs, "language"));
        t.setAgentSteps(rs.getString("agent_steps"));
        t.setDecisionLog(rs.getString("decision_log"));

        Timestamp ts = rs.getTimestamp("created_at");
        if (ts != null) {
            t.setCreatedAt(ts.toLocalDateTime());
        }
        return t;
    }

    private String readNullableColumn(ResultSet rs, String columnName) {
        try {
            return rs.getString(columnName);
        } catch (SQLException ex) {
            return null;
        }
    }
}
