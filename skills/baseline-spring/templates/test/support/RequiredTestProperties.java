package com.example.orders.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.test.context.TestPropertySource;

/**
 * The one place that gives every {@code @SpringBootTest} the keys that have no deployed default (CFG-12, TEST-CFG-05,
 * SPRING-TEST-15). Put it on each full-context test; a new required key is added here once, not in every test class.
 * All tests that use it share one cached context (SPRING-TEST-08). Values are fictitious (DP-ENV-01): never a real
 * secret (SEC-INC-01). Keep the list equal to the {@code required: true} entries of {@code configuration-keys.yaml}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@TestPropertySource(properties = {
    // one line per required key without deployed default, for example:
    // "spring.security.oauth2.client.provider.idp.issuer-uri=http://localhost:0/realms/test",
    // "spring.security.oauth2.client.registration.idp.client-secret=test-only-secret",
    // "app.sharing.public-base-url=http://localhost:8080",
})
public @interface RequiredTestProperties {}
