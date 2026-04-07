package com.natlangx.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

@Component
public class DBConnection {
    private final String url;
    private final String username;
    private final String password;
    private final String driver;

    public DBConnection(
            @Value("${natlangx.db.url}") String url,
            @Value("${natlangx.db.username}") String username,
            @Value("${natlangx.db.password}") String password,
            @Value("${natlangx.db.driver}") String driver) {
        this.url = url;
        this.username = username;
        this.password = password;
        this.driver = driver;
    }

    public Connection getConnection() throws SQLException {
        try {
            Class.forName(driver);
        } catch (ClassNotFoundException ex) {
            throw new SQLException("MySQL JDBC driver not found", ex);
        }
        return DriverManager.getConnection(url, username, password);
    }
}
