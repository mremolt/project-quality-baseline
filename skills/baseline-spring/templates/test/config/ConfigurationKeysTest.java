package com.example.orders.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * TEST-CFG-04 and TEST-CFG-05: the key list matches the code, and a required key has no deployed default. Skeleton:
 * fill the three readers. Own keys come from the generated {@code META-INF/spring-configuration-metadata.json}
 * (SPRING-CFG-04, names starting with {@code app.}); the list is {@code docs/configuration-keys.yaml} (CFG-12). Plain
 * JUnit, no Spring context (SPRING-TEST-07).
 */
class ConfigurationKeysTest {

    @Test
    void ownKeysInCodeAndKeyListAreTheSame() {
        Set<String> inCode = ownKeysFromMetadata();
        Set<String> inList = keysFromKeyList();
        assertThat(inCode).as("own keys missing from configuration-keys.yaml").isSubsetOf(inList);
        assertThat(inList).as("keys listed but no longer defined by the code").isSubsetOf(inCode);
    }

    @Test
    void aRequiredKeyHasNoValueInTheDeployedConfiguration() throws Exception {
        String deployed = Files.readString(Path.of("src/main/resources/application.yaml"));
        for (String key : requiredKeysFromKeyList()) {
            String leaf = key.substring(key.lastIndexOf('.') + 1);
            assertThat(deployed).as("required key %s must not be set in application.yaml", key).doesNotContain(leaf + ":");
        }
        // also assert no ${VAR:default} fallback and no @DefaultValue for these keys (grep the properties records)
    }

    private static Set<String> ownKeysFromMetadata() {
        throw new UnsupportedOperationException("read META-INF/spring-configuration-metadata.json, keep app.* names");
    }

    private static Set<String> keysFromKeyList() {
        throw new UnsupportedOperationException("parse docs/configuration-keys.yaml: all keys");
    }

    private static Set<String> requiredKeysFromKeyList() {
        throw new UnsupportedOperationException("parse docs/configuration-keys.yaml: entries with required: true");
    }
}
