package com.example.orders.support;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.context.annotation.Import;

/**
 * Meta-annotation for {@code @WebMvcTest} classes once the API chain requires authentication (SPRING-TEST-16): imports
 * the security configuration of the API and SPA chains (not the actuator chain, whose {@code EndpointRequest} needs the
 * actuator context, SPRING-OBS-02) and the doubles every slice needs. Use it next to
 * {@code @WebMvcTest(controllers = X.class)}; add the {@code @MockitoBean} of the controller's own port in the test.
 * Adapt the imported classes to the product's security configuration.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Import({SecuritySliceBeans.class /*, ApiSecurityConfiguration.class, SpaSecurityConfiguration.class */})
public @interface SecuritySlice {}
