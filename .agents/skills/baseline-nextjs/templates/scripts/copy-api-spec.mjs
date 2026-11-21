// NEXT-REL-06, TS-API-01: copies the backend's OpenAPI specs into openapi/, the folder Orval and the Docker build read.
// In a product repository the backend owns the spec (backend/openapi/*.yaml) and frontend/openapi/ is gitignored;
// the Docker build context is frontend/, so CI runs this before `docker build`. Without ../backend/openapi (a separate
// frontend repository, the template itself, the Docker build stage) it keeps openapi/ as it is.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const source = process.env['API_SPEC_SOURCE'] ?? '../backend/openapi';
const target = 'openapi';
const isSpec = (file) => /\.ya?ml$/.test(file);

if (!existsSync(source)) {
  console.log(`copy:api-spec: ${source} not found, keeping ${target}/ as it is`);
  process.exit(0);
}
const specs = readdirSync(source).filter(isSpec);
if (specs.length === 0) {
  console.error(`copy:api-spec: no *.yaml in ${source}`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
for (const stale of readdirSync(target).filter((file) => isSpec(file) && !specs.includes(file))) {
  rmSync(join(target, stale)); // a spec the backend dropped must not keep generating a client
}
for (const spec of specs) copyFileSync(join(source, spec), join(target, spec));
console.log(`copy:api-spec: ${specs.join(', ')} from ${source}`);
