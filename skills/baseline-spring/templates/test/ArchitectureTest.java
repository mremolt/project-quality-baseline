package com.example.orders;

import static com.tngtech.archunit.core.domain.JavaCall.Predicates.target;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.simpleNameStartingWith;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.type;
import static com.tngtech.archunit.core.domain.properties.HasName.Predicates.name;
import static com.tngtech.archunit.core.domain.properties.HasName.Predicates.nameMatching;
import static com.tngtech.archunit.core.domain.properties.HasOwner.Predicates.With.owner;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.codeUnits;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noCodeUnits;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.example.orders.stereotype.FileAdapter;
import com.example.orders.stereotype.HttpClientAdapter;
import com.example.orders.stereotype.MailAdapter;
import com.example.orders.stereotype.MessagingAdapter;
import com.example.orders.stereotype.MetricsAdapter;
import com.example.orders.stereotype.PersistenceAdapter;
import com.example.orders.stereotype.SchedulingAdapter;
import com.example.orders.stereotype.UseCase;
import com.example.orders.stereotype.WebAdapter;
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.AccessTarget;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaCodeUnit;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.properties.HasAnnotations;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.Architectures;
import com.tngtech.archunit.library.GeneralCodingRules;
import jakarta.persistence.Entity;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Clock;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

@AnalyzeClasses(packages = "com.example.orders", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    // Ring dependencies (ARCH-DEP). All adapters form one layer here; adaptersAreIndependent below checks that
    // adapters do not depend on each other (ARCH-DEP-05), so no adapter has to be listed by hand.
    @ArchTest
    static final ArchRule hexagonal = Architectures.onionArchitecture()
            .domainModels("..domain..")
            .domainServices("..ports..")
            .applicationServices("..application..")
            .adapter("adapters", "..adapter..")
            .withOptionalLayers(true);

    @ArchTest
    static final ArchRule adaptersCallPortsNotServices = noClasses()
            .that()
            .resideInAPackage("..adapter..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("..application..");

    // One slice per adapter: adapter.<direction>.<technology> (ARCH-DEP-05). Sub-packages such as rest.v1 belong
    // to their technology's slice.
    @ArchTest
    static final ArchRule adaptersAreIndependent =
            slices().matching("..adapter.(*).(*)..").should().notDependOnEachOther();

    // No cycles between any two packages of the service (ARCH-ENF-05).
    @ArchTest
    static final ArchRule noCycles =
            slices().matching("com.example.orders.(**)").should().beFreeOfCycles();

    // Several bounded contexts below the base package (ARCH-ORG-09), e.g. com.example.shop.billing and
    // com.example.shop.account: uncomment and set the base package. A context reaches another context only from
    // an outgoing adapter, through the other context's incoming ports (and the domain types they carry).
    // Needs a static import of JavaClass.Predicates.resideInAnyPackage. A shared kernel (ADR) needs one more
    // .ignoreDependency(alwaysTrue(), resideInAPackage("com.example.shop.sharedkernel..")).
    //
    // @ArchTest
    // static final ArchRule contextsMeetOnlyAtIncomingPorts = slices()
    //         .matching("com.example.shop.(*)..")
    //         .should()
    //         .notDependOnEachOther()
    //         .ignoreDependency(
    //                 resideInAPackage("..adapter.out.."), resideInAnyPackage("..ports.in..", "..domain.."));

    // Core = domain + ports + application. domain and ports use no framework at all (ARCH-DEP-02, SPRING-LIB-04).
    @ArchTest
    static final ArchRule domainAndPortsAreFrameworkFree = noClasses()
            .that()
            .resideInAnyPackage("..domain..", "..ports..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage(
                    "org.springframework..",
                    "jakarta.persistence..",
                    "com.fasterxml.jackson.annotation..",
                    "com.fasterxml.jackson.databind..",
                    "tools.jackson..",
                    "org.apache.kafka..",
                    "software.amazon..",
                    "io.swagger..",
                    "org.springdoc..",
                    "io.github.springwolf..",
                    "io.micrometer..",
                    "io.opentelemetry..",
                    "org.slf4j..",
                    "ch.qos.logback..");

    // application may use only the JDK, the own code and the few framework types a use case needs: transactions
    // (SPRING-ARCH-07), coarse @PreAuthorize checks (SPRING-SEC-02), logging (SPRING-LOG-06) and the Observation API
    // (SPRING-OBS-06). No EntityManager, KafkaTemplate, RestClient or any other adapter technology (ARCH-ADP-01,
    // ARCH-DEP-03). Widening this list is an ADR, not a quick fix (SEC-REV-02).
    @ArchTest
    static final ArchRule applicationUsesOnlyAllowedTypes = classes()
            .that()
            .resideInAPackage("..application..")
            .should()
            .onlyDependOnClassesThat()
            .resideInAnyPackage(
                    "java..",
                    "com.example.orders..",
                    "org.jspecify..",
                    "org.springframework.transaction..",
                    "org.springframework.security.access.prepost..",
                    "org.slf4j..",
                    "io.micrometer.observation..");

    // Use cases get language as data (a Language value object in the command), never from the request (SPRING-I18N-04).
    // applicationUsesOnlyAllowedTypes already excludes these types; this rule names them for a precise failure message.
    @ArchTest
    static final ArchRule applicationHasNoJsonOrI18nTypes = noClasses()
            .that()
            .resideInAPackage("..application..")
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("com.fasterxml.jackson..", "tools.jackson..")
            .orShould()
            .dependOnClassesThat()
            .haveFullyQualifiedName("org.springframework.context.MessageSource")
            .orShould()
            .dependOnClassesThat()
            .haveFullyQualifiedName("org.springframework.context.i18n.LocaleContextHolder")
            .orShould()
            .dependOnClassesThat()
            .haveFullyQualifiedName("org.springframework.web.servlet.LocaleResolver");

    // Locale must not travel through the core (SPRING-I18N-04). Only fields and signatures are checked:
    // Locale.ROOT for case conversion (required by Error Prone's StringCaseLocaleUsage) stays possible.
    @ArchTest
    static final ArchRule noLocaleFieldsInCore = noFields()
            .that()
            .areDeclaredInClassesThat()
            .resideInAnyPackage("..domain..", "..ports..", "..application..")
            .should()
            .haveRawType(Locale.class);

    @ArchTest
    static final ArchRule noLocaleInCoreSignatures = codeUnits()
            .that()
            .areDeclaredInClassesThat()
            .resideInAnyPackage("..domain..", "..ports..", "..application..")
            .should(notTakeOrReturnLocale());

    @ArchTest
    static final ArchRule noTransactionalAdapterClasses =
            noClasses().that().resideInAPackage("..adapter..").should().beAnnotatedWith(Transactional.class);

    @ArchTest
    static final ArchRule noTransactionalAdapterMethods = noMethods()
            .that()
            .areDeclaredInClassesThat()
            .resideInAPackage("..adapter..")
            .should()
            .beAnnotatedWith(Transactional.class);

    // Caching is an adapter concern (SPRING-RES-14): @Cacheable/@CacheEvict only on outgoing adapters.
    @ArchTest
    static final ArchRule cacheOnlyInAdapters = noClasses()
            .that()
            .resideInAnyPackage("..domain..", "..ports..", "..application..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("org.springframework.cache..");

    // Configuration is bound with @ConfigurationProperties records, never @Value (SPRING-CFG-03).
    @ArchTest
    static final ArchRule noValueFields =
            noFields().should().beAnnotatedWith("org.springframework.beans.factory.annotation.Value");

    @ArchTest
    static final ArchRule noValueMethods =
            noCodeUnits().should().beAnnotatedWith("org.springframework.beans.factory.annotation.Value");

    @ArchTest
    static final ArchRule noValueParameters = codeUnits().should(notHaveValueParameters());

    // Secret values in properties records use the self-masking Secret type, never a plain String (CFG-07, SPRING-CFG-11).
    @ArchTest
    static final ArchRule secretsUseSecretType = fields()
            .that()
            .areDeclaredInClassesThat()
            .haveSimpleNameEndingWith("Properties")
            .and()
            .haveNameMatching("(?i).*(password|secret|token|apikey|credential|privatekey).*")
            .should()
            .haveRawType("com.example.orders.config.Secret")
            .allowEmptyShould(true);

    // One @Transactional: Spring's. jakarta.transaction.Transactional comes in with JPA and is easy to import by mistake.
    @ArchTest
    static final ArchRule onlySpringTransactional = noClasses()
            .should()
            .dependOnClassesThat()
            .haveFullyQualifiedName("jakarta.transaction.Transactional");

    // allowEmptyShould: the one bootstrap exception to ARCH-ENF-02 / JAVA-ARCH-08. A new service has no @Entity yet,
    // and the rule would fail with "failed to check any classes". Remove allowEmptyShould with the first entity
    // (a service without JPA removes the rule instead).
    @ArchTest
    static final ArchRule jpaEntitiesStayInAdapter = classes()
            .that()
            .areAnnotatedWith(Entity.class)
            .should()
            .resideInAPackage("..adapter.out.jpa..")
            .andShould()
            .notBePublic()
            .allowEmptyShould(true);

    // Scanned classes stay package-private: Spring instantiates them reflectively (JAVA-ARCH-01, SPRING-ARCH-04).
    @ArchTest
    static final ArchRule stereotypedClassesArePackagePrivate = classes()
            .that()
            .areAnnotatedWith(UseCase.class)
            .or()
            .areAnnotatedWith(WebAdapter.class)
            .or()
            .areAnnotatedWith(MessagingAdapter.class)
            .or()
            .areAnnotatedWith(HttpClientAdapter.class)
            .or()
            .areAnnotatedWith(MailAdapter.class)
            .or()
            .areAnnotatedWith(FileAdapter.class)
            .or()
            .areAnnotatedWith(PersistenceAdapter.class)
            .or()
            .areAnnotatedWith(SchedulingAdapter.class)
            .or()
            .areAnnotatedWith(MetricsAdapter.class)
            .should()
            .notBePublic();

    // Use cases live in application (SPRING-ARCH-04).
    @ArchTest
    static final ArchRule useCasesLiveInApplication =
            classes().that().areAnnotatedWith(UseCase.class).should().resideInAPackage("..application..");

    // Outgoing HTTP clients live in adapter.out.http (SPRING-ARCH-04). allowEmptyShould: bootstrap exception as for
    // jpaEntitiesStayInAdapter; remove it with the first @HttpClientAdapter.
    @ArchTest
    static final ArchRule httpClientAdaptersLiveInAdapterOutHttp = classes()
            .that()
            .areAnnotatedWith(HttpClientAdapter.class)
            .should()
            .resideInAPackage("..adapter.out.http..")
            .allowEmptyShould(true);

    // Outgoing mail (SMTP) lives in adapter.out.mail, adapters that write files (CSV, Excel, PDF) in adapter.out.file
    // (SPRING-ARCH-04). allowEmptyShould: bootstrap exception; remove it with the first adapter of the kind.
    @ArchTest
    static final ArchRule mailAdaptersLiveInAdapterOutMail = classes()
            .that()
            .areAnnotatedWith(MailAdapter.class)
            .should()
            .resideInAPackage("..adapter.out.mail..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule fileAdaptersLiveInAdapterOutFile = classes()
            .that()
            .areAnnotatedWith(FileAdapter.class)
            .should()
            .resideInAPackage("..adapter.out.file..")
            .allowEmptyShould(true);

    // Every class lives in a ring, an adapter package adapter.<in|out>.<technology>, the composition root or a
    // support package that spring.md names (ARCH-ORG-01, SPRING-ARCH-01): no misc, util or common packages.
    // package-info is ignored, so container packages (adapter, adapter.in, ports) can be @NullMarked (JAVA-TOOL-08).
    @ArchTest
    static final ArchRule everyClassHasAHome = classes()
            .that()
            .doNotHaveSimpleName("package-info")
            .should()
            .resideInAnyPackage(
                    "com.example.orders",
                    "..domain..",
                    "..application..",
                    "..ports.in..",
                    "..ports.out..",
                    "..adapter.in.*..",
                    "..adapter.out.*..",
                    "com.example.orders.stereotype",
                    "com.example.orders.config");

    // NullAway runs with OnlyNullMarked=true (JAVA-TOOL-07), so a package without a @NullMarked package-info.java
    // is silently not checked at all (JAVA-TOOL-08).
    @ArchTest
    static final ArchRule everyPackageIsNullMarked =
            classes().that().doNotHaveSimpleName("package-info").should(resideInANullMarkedPackage());

    // The current time comes only from the Clock bean in the configuration package (ARCH-UC-20, JAVA-ARCH-14).
    // now(clock) stays allowed; now(), now(zone), Clock.system*() and System.currentTimeMillis() do not.
    @ArchTest
    static final ArchRule noDirectClockAccess = noClasses()
            .that()
            .resideOutsideOfPackage("com.example.orders.config")
            .should()
            .callMethodWhere(DescribedPredicate.describe(
                    "read the system clock", call -> readsSystemClock(call.getTarget())))
            .because("time comes from the injected Clock (ARCH-UC-20, JAVA-ARCH-14)");

    @ArchTest
    static final ArchRule noFieldInjection = GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION;

    @ArchTest
    static final ArchRule noStandardStreams = GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS;

    @ArchTest
    static final ArchRule noJavaUtilLogging = GeneralCodingRules.NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING;

    // Jackson 3 only (SPRING-LIB-04). springdoc 3.x still pulls jackson-databind 2 onto the compile
    // classpath, so nothing stops an accidental import of the old ObjectMapper except this rule.
    // Jackson annotations (com.fasterxml.jackson.annotation) stay allowed: Jackson 3 uses them.
    @ArchTest
    static final ArchRule noJackson2 = noClasses()
            .should()
            .dependOnClassesThat()
            .resideInAnyPackage("com.fasterxml.jackson.databind..", "com.fasterxml.jackson.core..");

    // RestTemplate is formally deprecated in Spring Framework 7.1 (Boot 4.2); use RestClient or HTTP Service Clients
    // (SPRING-LIB-06).
    @ArchTest
    static final ArchRule noRestTemplate = noClasses()
            .should()
            .dependOnClassesThat(
                    simpleNameStartingWith("RestTemplate").and(resideInAPackage("org.springframework..")));

    // Clients started with library defaults have no configured timeouts and no trace propagation (RES-TMO-01,
    // SPRING-RES-01, SPRING-OBS-09). Build them from the injected RestClient.Builder or as HTTP Service Clients;
    // a JDK HttpClient comes from HttpClient.newBuilder() with connectTimeout(...).
    @ArchTest
    static final ArchRule noUnconfiguredHttpClients = noClasses()
            .should()
            .callMethodWhere(target(owner(type(RestClient.class))).and(target(nameMatching("create|builder"))))
            .orShould()
            .callMethodWhere(target(owner(type(HttpClient.class))).and(target(name("newHttpClient"))));

    // Decimals cross the REST boundary as JSON strings through ApiDecimal, never as JSON numbers (API-REST-01,
    // SPRING-REST-04). Record components are fields, so this covers request and response records.
    // Adjust the class name if ApiDecimal lives elsewhere; generic types such as List<BigDecimal> are not caught.
    @ArchTest
    static final ArchRule noRawNumbersInRestRecords = noFields()
            .that()
            .areDeclaredInClassesThat()
            .resideInAPackage("..adapter.in.rest..")
            .and()
            .areNotDeclaredIn("com.example.orders.adapter.in.rest.ApiDecimal")
            .should()
            .haveRawType(BigDecimal.class)
            .orShould()
            .haveRawType(double.class)
            .orShould()
            .haveRawType(Double.class)
            .orShould()
            .haveRawType(float.class)
            .orShould()
            .haveRawType(Float.class);

    // A successful update answers 200 with the resource or at least its new version, never a bare 204 (API-REST-11,
    // SPRING-REST-12): no void PUT/PATCH handler, no @ResponseStatus(NO_CONTENT), no ResponseEntity.noContent().
    // allowEmptyShould: bootstrap exception; remove it with the first PUT or PATCH endpoint.
    @ArchTest
    static final ArchRule updatesAnswerWithTheResource = methods()
            .that()
            .areAnnotatedWith(PutMapping.class)
            .or()
            .areAnnotatedWith(PatchMapping.class)
            .should(answerWithTheResource())
            .allowEmptyShould(true);

    // Request and response records have unique simple names: springdoc names schemas by simple name and silently
    // merges two records of the same name into one schema (SPRING-API-02).
    @ArchTest
    static void restRecordNamesAreUnique(JavaClasses productionClasses) {
        Map<String, List<String>> bySimpleName = productionClasses.stream()
                .filter(record -> resideInAPackage("..adapter.in.rest..").test(record))
                .filter(record -> record.getSimpleName().endsWith("Request")
                        || record.getSimpleName().endsWith("Response"))
                .collect(Collectors.groupingBy(
                        JavaClass::getSimpleName,
                        TreeMap::new,
                        Collectors.mapping(JavaClass::getName, Collectors.toList())));
        List<String> duplicates = bySimpleName.values().stream()
                .filter(names -> names.size() > 1)
                .map(String::valueOf)
                .toList();
        if (!duplicates.isEmpty()) {
            throw new AssertionError("REST records with the same simple name (SPRING-API-02): " + duplicates);
        }
    }

    // Mass assignment (SPRING-SEC-34): request records never carry fields that only the server may set.
    // Adjust the suffix if request records are named differently. An admin endpoint that legitimately assigns
    // such a field (roles of another user) is listed with its reason; its use case authorizes with an admin
    // permission, and the list is reviewed like a lowered rule (SEC-REV-02).
    // Entry: "<fully qualified Request class>#<field>" (nested records: Outer$Inner); commas between entries, none after
    // the last.
    private static final Set<String> ADMIN_ASSIGNED_FIELDS = Set.of(
            // "com.example.orders.adapter.in.rest.v1.UserController$ChangeRolesRequest#roles", // admin assigns roles
            //     of another user; ChangeRolesService requires MANAGE_USERS
    );

    // allowEmptyShould: bootstrap exception as for jpaEntitiesStayInAdapter; remove it with the first Request record.
    @ArchTest
    static final ArchRule noServerOwnedFieldsInRequests = noFields()
            .that()
            .areDeclaredInClassesThat()
            .resideInAPackage("..adapter.in.rest..")
            .and()
            .areDeclaredInClassesThat()
            .haveSimpleNameEndingWith("Request")
            .and(notListedIn(ADMIN_ASSIGNED_FIELDS))
            .should()
            // Synonyms count too (permissionGroups, userRoles): renaming never escapes the rule.
            .haveNameMatching("ownerId|tenantId|createdBy|createdAt|.*([Rr]ole|[Pp]ermission|[Gg]roup)s?")
            .allowEmptyShould(true);

    // No process execution (SPRING-SEC-31). A product that needs one names its single adapter here, with a reason.
    @ArchTest
    static final ArchRule noProcessExecution = noClasses()
            .should()
            .dependOnClassesThat()
            .belongToAnyOf(ProcessBuilder.class)
            .orShould()
            .callMethod(Runtime.class, "exec", String.class)
            .orShould()
            .callMethod(Runtime.class, "exec", String[].class);

    // Every use case that takes an id from the caller is called by a test method tagged "cross-user" (SPRING-SEC-16/35):
    // the tagged method (or any method of a tagged class) calls the use case or its incoming port. A tagged method
    // elsewhere in the same test class does not cover the use cases the class only mentions.
    // A use case that takes no caller-supplied id is listed here with a reason. Typical entries: use cases that
    // create a new aggregate, act only on the caller's own row, or run without a caller (scheduled jobs, start-up
    // jobs, provider-initiated calls such as back-channel logout). Commas between entries, none after the last.
    private static final Set<String> NO_CALLER_SUPPLIED_ID = Set.of(
            // "com.example.orders.application.PlaceOrderService", // creates a new order, takes no id
            // "com.example.orders.application.DeliverQueuedMailService", // scheduled job: no caller, no id
    );

    @ArchTest
    static void everyUseCaseHasACrossUserTest(JavaClasses productionClasses) {
        JavaClasses withTests = new ClassFileImporter().importPackages("com.example.orders");
        Set<String> called = withTests.stream()
                .flatMap(test -> test.getMethods().stream())
                .filter(ArchitectureTest::isCrossUserTest)
                .flatMap(method -> method.getCallsFromSelf().stream())
                .map(call -> call.getTargetOwner().getName())
                .collect(Collectors.toSet());
        List<String> missing = productionClasses.stream()
                .filter(useCase -> useCase.isAnnotatedWith(UseCase.class))
                .filter(useCase -> !called.contains(useCase.getName())
                        && useCase.getRawInterfaces().stream().noneMatch(port -> called.contains(port.getName())))
                .map(JavaClass::getName)
                .filter(name -> !NO_CALLER_SUPPLIED_ID.contains(name))
                .sorted()
                .toList();
        if (!missing.isEmpty()) {
            throw new AssertionError("Use cases without a @Tag(\"cross-user\") test (SPRING-SEC-16): " + missing);
        }
    }

    // Every controller is covered by a web slice test, where the 401/403/success cases of SPRING-SEC-10 live
    // (SPRING-TEST-12): named in @WebMvcTest(controllers = ...) of some test class, or <Controller>Test next to it.
    // A bare @WebMvcTest loads every controller and covers none.
    @ArchTest
    static void everyControllerHasAWebSliceTest(JavaClasses productionClasses) {
        JavaClasses testClasses = new ClassFileImporter().importPackages("com.example.orders");
        Set<String> testNames = new HashSet<>();
        Set<String> covered = new HashSet<>();
        for (JavaClass testClass : testClasses) {
            testNames.add(testClass.getName());
            testClass.tryGetAnnotationOfType(WEB_MVC_TEST).ifPresent(annotation -> {
                for (String attribute : List.of("controllers", "value")) {
                    annotation.get(attribute).ifPresent(value -> {
                        for (Object controller : (Object[]) value) {
                            covered.add(((JavaClass) controller).getName());
                        }
                    });
                }
            });
        }
        List<String> missing = productionClasses.stream()
                .filter(controller -> controller.isAnnotatedWith(RestController.class))
                .map(JavaClass::getName)
                .filter(name -> !covered.contains(name) && !testNames.contains(name + "Test"))
                .sorted()
                .toList();
        if (!missing.isEmpty()) {
            throw new AssertionError("Controllers without a web slice test (SPRING-TEST-12): " + missing);
        }
    }

    private static final String WEB_MVC_TEST = "org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest";

    private static boolean isCrossUserTest(JavaMethod method) {
        JavaClass owner = method.getOwner();
        if (hasCrossUserTag(method) || isCrossUserClass(owner)) {
            return true;
        }
        // Calls inside a lambda are compiled into lambda$<method>$<n> of the same class.
        return method.getName().startsWith("lambda$")
                && owner.getMethods().stream()
                        .anyMatch(tagged -> hasCrossUserTag(tagged)
                                && method.getName().startsWith("lambda$" + tagged.getName() + "$"));
    }

    private static boolean isCrossUserClass(JavaClass javaClass) {
        return hasCrossUserTag(javaClass)
                || javaClass.getEnclosingClass().map(ArchitectureTest::isCrossUserClass).orElse(false);
    }

    private static boolean hasCrossUserTag(HasAnnotations<?> element) {
        return element.tryGetAnnotationOfType(Tag.class)
                .map(tag -> "cross-user".equals(tag.value()))
                .orElse(false);
    }

    private static ArchCondition<JavaMethod> answerWithTheResource() {
        return new ArchCondition<>("answer with the resource or its new version, never a bare 204") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean bare = method.getRawReturnType().isEquivalentTo(void.class)
                        || method.tryGetAnnotationOfType(ResponseStatus.class)
                                .map(status -> status.value() == HttpStatus.NO_CONTENT
                                        || status.code() == HttpStatus.NO_CONTENT)
                                .orElse(false)
                        || method.getMethodCallsFromSelf().stream()
                                .anyMatch(call -> call.getTargetOwner().isEquivalentTo(ResponseEntity.class)
                                        && "noContent".equals(call.getName()));
                if (bare) {
                    events.add(SimpleConditionEvent.violated(
                            method, method.getFullName() + " answers without the resource (API-REST-11)"));
                }
            }
        };
    }

    private static DescribedPredicate<JavaField> notListedIn(Set<String> allowed) {
        return DescribedPredicate.describe(
                "not listed in ADMIN_ASSIGNED_FIELDS",
                field -> !allowed.contains(field.getOwner().getName() + "#" + field.getName()));
    }

    private static ArchCondition<JavaCodeUnit> notTakeOrReturnLocale() {
        return new ArchCondition<>("not take or return java.util.Locale") {
            @Override
            public void check(JavaCodeUnit unit, ConditionEvents events) {
                boolean usesLocale = unit.getRawReturnType().isEquivalentTo(Locale.class)
                        || unit.getRawParameterTypes().stream().anyMatch(type -> type.isEquivalentTo(Locale.class));
                if (usesLocale) {
                    events.add(SimpleConditionEvent.violated(unit, unit.getDescription() + " uses java.util.Locale"));
                }
            }
        };
    }

    private static ArchCondition<JavaCodeUnit> notHaveValueParameters() {
        return new ArchCondition<>("not have parameters annotated with @Value") {
            @Override
            public void check(JavaCodeUnit unit, ConditionEvents events) {
                boolean usesValue = unit.getParameters().stream()
                        .anyMatch(p -> p.isAnnotatedWith("org.springframework.beans.factory.annotation.Value"));
                if (usesValue) {
                    events.add(SimpleConditionEvent.violated(unit, unit.getDescription() + " injects @Value"));
                }
            }
        };
    }

    private static final Set<String> TIME_TYPES = Set.of(
            "java.time.Instant",
            "java.time.LocalDate",
            "java.time.LocalDateTime",
            "java.time.LocalTime",
            "java.time.ZonedDateTime",
            "java.time.OffsetDateTime",
            "java.time.YearMonth");

    private static boolean readsSystemClock(AccessTarget.MethodCallTarget target) {
        String owner = target.getOwner().getName();
        String method = target.getName();
        boolean withoutClock =
                target.getRawParameterTypes().stream().noneMatch(type -> type.isEquivalentTo(Clock.class));
        return (TIME_TYPES.contains(owner) && method.equals("now") && withoutClock)
                || (owner.equals("java.time.Clock") && method.startsWith("system"))
                || (owner.equals("java.lang.System") && method.equals("currentTimeMillis"));
    }

    private static ArchCondition<JavaClass> resideInANullMarkedPackage() {
        return new ArchCondition<>("reside in a package whose package-info.java is @NullMarked") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                if (!javaClass.getPackage().isAnnotatedWith("org.jspecify.annotations.NullMarked")) {
                    events.add(SimpleConditionEvent.violated(
                            javaClass,
                            javaClass.getPackageName() + " has no @NullMarked package-info.java (JAVA-TOOL-08)"));
                }
            }
        };
    }
}
