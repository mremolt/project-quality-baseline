#!/usr/bin/env node
// Scaffolds a backend use case in the ring layout (ARCH-UC-01..06, SPRING-ARCH-04/07/08):
//   node tools/new-use-case.mjs <cut> <UseCaseName>      e.g.  node tools/new-use-case.mjs recording StartWorkDay
// Copy to `tools/new-use-case.mjs` (SPRING-ARCH-19) and set APP_PACKAGE and the backend folder below.
// Creates the command record, the incoming port, the service with @UseCase/@Transactional and a London-style test.
// Prints the remaining checklist (controller, slice test, cross-user test, spec update).
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [cut, name] = process.argv.slice(2);
if (!cut || !name || !/^[a-z]+$/u.test(cut) || !/^[A-Z][A-Za-z0-9]+$/u.test(name)) {
  console.error('Usage: node tools/new-use-case.mjs <cut-lowercase> <UseCaseNamePascal>');
  process.exit(1);
}
const APP_PACKAGE = 'com.example.app'; // product base package
const BACKEND = 'backend';
const pkgPath = APP_PACKAGE.split('.');
const base = join(BACKEND, 'src', 'main', 'java', ...pkgPath);
const test = join(BACKEND, 'src', 'test', 'java', ...pkgPath);
const pkg = APP_PACKAGE;
const files = {
  [join(base, 'ports', 'in', `${name}Command.java`)]: `package ${pkg}.ports.in;

// Caller: the record in domain (SPRING-SEC-39)
import ${pkg}.domain.Caller;
import java.util.Objects;

/** Input of ${name}: validates itself when constructed (ARCH-UC-05); no null for "not applicable" (ARCH-UC-08). */
public record ${name}Command(Caller caller) {
    public ${name}Command {
        Objects.requireNonNull(caller, "caller");
    }
}
`,
  [join(base, 'ports', 'in', `${name}UseCase.java`)]: `package ${pkg}.ports.in;

public interface ${name}UseCase {
    void ${name[0].toLowerCase() + name.slice(1)}(${name}Command command);
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
    public void ${name[0].toLowerCase() + name.slice(1)}(${name}Command command) {
        // authorize with command.caller() first (ARCH-UC-15), then act through outgoing ports
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
}
`,
};
for (const [file, content] of Object.entries(files)) {
  if (existsSync(file)) {
    console.error(`${file} exists already`);
    process.exit(1);
  }
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
  console.log(`created ${file}`);
}
console.log(`
Checklist (each item once caused a red build):
 [ ] package-info.java with @NullMarked in new packages that hold classes; @Nullable where null is legal (NullAway)
 [ ] controller in adapter.in.rest.v1: @WebAdapter @RestController, operationId, produces, @Schema required, 401/403 problem docs
 [ ] web slice test named <Controller>Test or @WebMvcTest(controllers=...): 401, 403 (no CSRF), success
 [ ] a test tagged @Tag("cross-user") references ${name}Service, or list it in NO_CALLER_SUPPLIED_ID with a reason
 [ ] ./mvnw spotless:apply, then ./mvnw verify -Dopenapi.update=true, commit the committed OpenAPI spec
 [ ] N+1 note in the commit message (API-N1-01); new table/column -> expand/contract migration (SPRING-DB-05)
 [ ] new personal data -> the data-protection inventory; new error code -> messages.properties + _de + _en parity (TEST-I18N-06)`);
