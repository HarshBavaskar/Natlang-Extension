package com.natlangx.dao;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Repository;

import com.natlangx.config.DBConnection;
import com.natlangx.dto.DictionaryEntryRequest;
import com.natlangx.dto.DictionaryEntryResponse;
import com.natlangx.exception.ApiException;

@Repository
public class DictionaryDAO {
    private final DBConnection dbConnection;

    public DictionaryDAO(DBConnection dbConnection) {
        this.dbConnection = dbConnection;
    }

    public int upsert(List<DictionaryEntryRequest> entries) {
        String sql = "INSERT INTO deterministic_dictionary_entries(term, canonical, confidence, source) VALUES(?,?,?,?) "
                + "ON DUPLICATE KEY UPDATE canonical=VALUES(canonical), confidence=VALUES(confidence), source=VALUES(source), updated_at=CURRENT_TIMESTAMP";

        try (Connection conn = dbConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ensureTable(conn);
            int count = 0;
            for (DictionaryEntryRequest entry : entries) {
                ps.setString(1, normalize(entry.getTerm()));
                ps.setString(2, normalize(entry.getCanonical()));
                ps.setDouble(3, entry.getConfidence() == null ? 0.7 : entry.getConfidence());
                ps.setString(4, entry.getSource() == null || entry.getSource().isBlank() ? "unknown" : entry.getSource());
                ps.addBatch();
                count++;
            }
            ps.executeBatch();
            return count;
        } catch (SQLException ex) {
            throw new ApiException("Failed to upsert dictionary entries", ex);
        }
    }

    public List<DictionaryEntryResponse> findAll() {
        String sql = "SELECT term, canonical, confidence, source FROM deterministic_dictionary_entries ORDER BY term ASC";
        List<DictionaryEntryResponse> items = new ArrayList<>();

        try (Connection conn = dbConnection.getConnection();
             Statement st = conn.createStatement()) {
            ensureTable(conn);
            try (ResultSet rs = st.executeQuery(sql)) {
                while (rs.next()) {
                    items.add(new DictionaryEntryResponse(
                            rs.getString("term"),
                            rs.getString("canonical"),
                            rs.getDouble("confidence"),
                            rs.getString("source")
                    ));
                }
            }
            return items;
        } catch (SQLException ex) {
            throw new ApiException("Failed to load dictionary entries", ex);
        }
    }

    private void ensureTable(Connection conn) throws SQLException {
        String ddl = "CREATE TABLE IF NOT EXISTS deterministic_dictionary_entries ("
                + "id INT PRIMARY KEY AUTO_INCREMENT,"
                + "term VARCHAR(255) NOT NULL UNIQUE,"
                + "canonical VARCHAR(255) NOT NULL,"
                + "confidence DOUBLE NOT NULL DEFAULT 0.7,"
                + "source VARCHAR(100) DEFAULT 'unknown',"
                + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
                + ")";
        try (Statement st = conn.createStatement()) {
            st.execute(ddl);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }
}
