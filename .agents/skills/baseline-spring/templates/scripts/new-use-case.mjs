#!/usr/bin/env node
// Scaffolds a backend use case in the ring layout (ARCH-UC-01..06, SPRING-ARCH-04/07/08/19):
//   node tools/new-use-case.mjs <cut> <UseCaseName> [--with-controller]
//   e.g. node tools/new-use-case.mjs ordering CancelOrder --with-controller
// Copy to `tools/new-use-case.mjs` and set APP_PACKAGE, BACKEND and SLICE_IMPORT below.
// Creates the command record, the incoming port, the service with @UseCase/@Transactional and a London-style test.
// --with-controller adds the REST controller in adapter.in.rest.v1 and its web slice test (401, 403, success;
// SPRING-SEC-10, SPRING-TEST-12). Prints the remaining checklist.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const withController = args.includes('--with-controller');
const [cut, name] = args.filter((a) => !a.startsWith('--'));
if (!cut || !name || !/^[a-z]+$/u.test(cut) || !/^[A-Z][A-Za-z0-9]+$/u.test(name)) {
  console.error('Usage: node tools/new-use-case.mjs <cut-lowercase> <UseCaseNamePascal> [--with-controller]');
  process.exit(1);
}
const APP_PACKAGE = 'com.example.orders'; // product base package, as in ArchitectureTest
const BACKEND = 'backend';
// The product's security configuration (filter chains, Caller argument resolver, problem-details handlers) that a
// web slice test imports, so 401/403 come from the real chain (SPRING-SEC-10).
const SLICE_IMPORT = `${APP_PACKAGE}.adapter.in.rest.SecurityConfiguration`;

const pkgPath = APP_PACKAGE.split('.');
const base = join(BACKEND, 'src', 'main', 'java', ...pkgPath);
const test = join(BACKEND, 'src', 'test', 'java', ...pkgPath);
const pkg = APP_PACKAGE;
const method = name[0].toLowerCase() + name.slice(1);
const kebab = name.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
const sliceImportSimple = SLICE_IMPORT.slice(SLICE_IMPORT.lastIndexOf('.') + 1);

const files = {
  [join(base, 'ports', 'in', `${name}Command.java`)]: `package ${pkg}.ports.in;

import ${pkg}.domain.Caller;
import java.util.Objects;

/**
 * Input of ${name}: validates itself when constructed (ARCH-UC-05); no null for "not applicable" (ARCH-UC-08). The
 * Caller is the record in domain (SPRING-SEC-39).
 */
public record ${name}Command(Caller caller) {
    public ${name}Command {
        Objects.requireNonNull(caller, "caller");
    }
}
`,
  [join(base, 'ports', 'in', `${name}UseCase.java`)]: `package ${pkg}.ports.in;

public interface ${name}UseCase {
    void ${method}(${name}Command command);
}
`,
  [join(base, 'application', cut, `${name}Service.java`)]: `package ${pkg}.application.${cut};

import ${pkg}.ports.in.${name}Command;
import ${pkg}.ports.in.${name}UseCase;
import ${pkg}.stereotype.UseCase;
import org.springframework.transaction.annotation.Transactional;

@UseCase
class ${name}Service implements ${name}UseCase {

    ${name}Service() {}

    @Override
    @Transactional
    public void ${method}(${name}Command command) {
        // authorize with command.caller() first (ARCH-UC-15): AccessDeniedException or NotFoundException (ARCH-UC-13),
        // then act through outgoing ports
        throw new UnsupportedOperationException("TODO: write the failing test first (TEST-TDD-01)");
    }
}
`,
  [join(test, 'application', cut, `${name}ServiceTest.java`)]: `package ${pkg}.application.${cut};

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

class ${name}ServiceTest {

    @Test
    @Disabled("replace with the first behaviour test, then remove this line")
    void firstBehaviour() {}

    // Cross-user test (SPRING-SEC-16): user B addresses user A's object and gets NotFoundException (SPRING-SEC-36).
    // Add @Tag("cross-user") to this method when it calls the service and asserts; until then ArchitectureTest.everyUseCaseHasACrossUserTest stays red,
    // unless the use case takes no caller-supplied id and is listed in NO_CALLER_SUPPLIED_ID with a reason.
    @Test
    @Disabled("write the cross-user test, tag it, then remove this line")
    void anotherUsersObjectIsNotFound() {}
}
`,
};

if (withController) {
  files[join(base, 'adapter', 'in', 'rest', 'v1', `${name}Controller.java`)] = `package ${pkg}.adapter.in.rest.v1;

import ${pkg}.domain.Caller;
import ${pkg}.ports.in.${name}Command;
import ${pkg}.ports.in.${name}UseCase;
import ${pkg}.stereotype.WebAdapter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST adapter of ${name}. Name the resource and method after the REST conventions (API-REST-*) before the first
 * commit; the generated path is a placeholder. The Caller comes from the argument resolver, never from the request,
 * and is hidden from the spec (SPRING-API-07).
 */
@WebAdapter
@RestController
@RequestMapping("/api/v1/${cut}")
@Tag(name = "${cut}")
class ${name}Controller {

    private final ${name}UseCase useCase;

    ${name}Controller(${name}UseCase useCase) {
        this.useCase = useCase;
    }

    @PostMapping("/${kebab}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "${method}", summary = "TODO: one sentence")
    void ${method}(Caller caller) {
        useCase.${method}(new ${name}Command(caller));
    }
}
`;
  files[join(test, 'adapter', 'in', 'rest', 'v1', `${name}ControllerTest.java`)] = `package ${pkg}.adapter.in.rest.v1;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import ${SLICE_IMPORT};
import ${pkg}.ports.in.${name}UseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

// Web slice test (SPRING-SEC-10, SPRING-TEST-12). A resource server authenticates with jwt(); a BFF chain uses
// oidcLogin() and keeps the CSRF case. The 403 for a missing permission comes from the use case (ARCH-UC-13).
@WebMvcTest(controllers = ${name}Controller.class)
@Import(${sliceImportSimple}.class)
class ${name}ControllerTest {

    private static final String PATH = "/api/v1/${cut}/${kebab}";

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    ${name}UseCase useCase;

    @Test
    void answers401WithoutALogin() {
        var result = mvc.post().uri(PATH).with(csrf()).exchange();

        assertThat(result).hasStatus(401);
        assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("UNAUTHENTICATED");
        verifyNoInteractions(useCase);
    }

    @Test
    void answers403WhenTheUseCaseDeniesAccess() {
        // anonymous subclass of the abstract base type of ARCH-UC-13 (JAVA-ARCH-13), with its code constructor
        doThrow(new ${pkg}.domain.AccessDeniedException("ACCESS_DENIED") {}).when(useCase).${method}(any());

        var result = mvc.post().uri(PATH).with(jwt()).with(csrf()).exchange();

        assertThat(result).hasStatus(403);
        assertThat(result).bodyJson().extractingPath("$.code").isEqualTo("ACCESS_DENIED");
    }

    // BFF chain only (session cookie, SPRING-SEC-09); delete for a pure resource server chain.
    @Test
    void answers403WithoutACsrfToken() {
        var result = mvc.post().uri(PATH).with(jwt()).exchange();

        assertThat(result).hasStatus(403);
        verifyNoInteractions(useCase);
    }

    @Test
    void passesTheResolvedCallerToTheUseCase() {
        var result = mvc.post().uri(PATH).with(jwt()).with(csrf()).exchange();

        assertThat(result).hasStatus(204);
        verify(useCase).${method}(any());
    }
}
`;
}

for (const [file, content] of Object.entries(files)) {
  if (existsSync(file)) {
    console.error(`${file} exists already`);
    process.exit(1);
  }
}
for (const [file, content] of Object.entries(files)) {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
  console.log(`created ${file}`);
}
console.log(`
Checklist (each item once caused a red build):
 [ ] package-info.java with @NullMarked in new packages; @Nullable where null is legal (NullAway)
 [ ] ${withController ? 'controller: name the resource and method (API-REST-*), request/response records with @Schema required' : 'controller in adapter.in.rest.v1 (or rerun with --with-controller): @WebAdapter @RestController, operationId, tag'}
 [ ] business error statuses documented as problem details with their codes (SPRING-API-05)
 [ ] cross-user test written and tagged, or ${name}Service listed in NO_CALLER_SUPPLIED_ID with a reason (SPRING-SEC-16)
 [ ] ./mvnw spotless:apply, then ./mvnw verify -Dopenapi.update=true, commit the refreshed OpenAPI spec (SPRING-API-08)
 [ ] N+1 note in the commit message (API-N1-01); new table/column -> expand/contract migration (SPRING-DB-05)
 [ ] new personal data -> the data-protection inventory; new error code -> message catalogs in every language (TEST-I18N-06)`);
