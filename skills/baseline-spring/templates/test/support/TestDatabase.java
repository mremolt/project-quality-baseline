package com.example.orders.support;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Resets database state between integration tests in one place (SPRING-TEST-13): truncates every application table
 * (everything in the {@code public} schema except the Flyway history), so no test keeps its own DELETE list. Import it
 * in the shared {@code @TestConfiguration} and call {@link #reset()} from an {@code @AfterEach} of a base class or a
 * JUnit extension. Tests that arrange unique rows per test may skip it; tests with fixed people (SPRING-TEST-14) need it.
 */
@Component
public class TestDatabase {

    private final JdbcTemplate jdbc;

    public TestDatabase(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void reset() {
        List<String> tables = jdbc.queryForList(
            """
            select quote_ident(table_name) from information_schema.tables
            where table_schema = 'public' and table_type = 'BASE TABLE'
              and table_name not in ('flyway_schema_history')
            """,
            String.class);
        if (!tables.isEmpty()) {
            jdbc.execute("TRUNCATE " + String.join(", ", tables) + " RESTART IDENTITY CASCADE");
        }
    }
}
