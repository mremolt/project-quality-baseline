package com.example.orders.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

/**
 * TEST-CFG-01: one binding test per {@code @ConfigurationProperties} record (SPRING-CFG-01): valid values bind, every
 * constraint rejects an invalid value, a missing required value fails the start. {@code Binder} with a map source runs
 * without Spring context, network or environment. Replace {@code SampleProperties} by the real record, one test class per record.
 */
class ConfigurationBindingTest {

    record SampleProperties(String name) {}

    @Test
    void validValuesBind() {
        var source = new MapConfigurationPropertySource(Map.of("app.sample.name", "x"));
        SampleProperties bound = new Binder(source).bind("app.sample", SampleProperties.class).get();
        assertThat(bound.name()).isEqualTo("x");
    }

    @Test
    void aMissingRequiredValueFailsTheBinding() {
        var source = new MapConfigurationPropertySource(Map.of());
        assertThat(new Binder(source).bind("app.sample", SampleProperties.class).isBound()).isFalse();
        // for a required component (@NotNull), bind with a ValidationBindHandler and assert the BindException
    }
}
