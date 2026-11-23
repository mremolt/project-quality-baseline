package com.example.orders.support;

import org.springframework.boot.test.context.TestConfiguration;

/**
 * Beans a {@code @WebMvcTest} slice lacks once security is on (SPRING-TEST-16): typically the {@code RestClient.Builder}
 * auto-configuration the OAuth2 client needs and {@code @MockitoBean}-style doubles for outgoing ports of the security
 * chain (session registry, identity-provider port). Fill it with what the product's security configuration injects; it
 * stays the only place that knows this list.
 */
@TestConfiguration(proxyBeanMethods = false)
public class SecuritySliceBeans {
    // e.g. @Bean RestClient.Builder restClientBuilder() { return RestClient.builder(); } (test only)
}
