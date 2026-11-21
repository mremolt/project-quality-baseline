# Next.js: Delivery

How a Next.js frontend meets [delivery-and-release.md](delivery-and-release.md) (REL-VER, REL-CD, REL-ZD) and [container-runtime.md](container-runtime.md) (REL-IMG, REL-RUN). The Next.js component is its own image, its own release unit and the BFF for its browser users ([04-solution-strategy/nextjs.md](../04-solution-strategy/nextjs.md), NEXT-D2). It does not ship a bundle inside a backend image, so the frontend delivery rules REL-FE-01..05 do not apply. This file replaces them with the rules below. BFF security: [security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md) and [node-bff.md](../08-crosscutting-concepts/security/node-bff.md). Configuration keys: [configuration/nextjs.md](../08-crosscutting-concepts/configuration/nextjs.md). Probes, logs and shutdown: [observability/nextjs.md](../08-crosscutting-concepts/observability/nextjs.md).

Everything marked *verified* was checked in a scratch build on 2026-11-20 with Next.js 16.4, Node 26 and Docker 29.8. Everything marked *to verify before first use* is listed in [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use).

## Rules

### Topology and release unit

- **NEXT-REL-01: The Next.js component is a deployable image and the BFF; no other server serves its pages or files.** It renders the pages, serves `/_next/static/`, handles login, session and the API proxy (NODE-BFF-01), and calls the backend as a resource server. This is the stated exception to REPO-LAY-03 ("a frontend component delivers a bundle"): the `frontend/` folder of a Next.js product builds an image, like a backend. No nginx, CDN or object store in front for the static files without an ADR; the ADR states how NEXT-REL-11..14 and the CSP nonce (NEXT-SEC-03) still hold.
  *Why:* the per-request nonce, the session cookie and the action endpoints come from the Next.js server; a second server for files splits the release and the skew handling.
- **NEXT-REL-02: The component is its own release unit with tags `frontend/v1.4.0`** (REPO-CI-05; `frontend-<name>/v…` with several). The release tool keeps its changelog in `frontend/` (REL-VER-03/04). REL-FE-05 (frontend released with the BFF) does not apply, because this component is the BFF. Backend and frontend are released and rolled out independently, so both directions stay compatible with the other's previous release (REL-ZD-03, REPO-API-02): the backend keeps the API versions the previous frontend release calls, and the frontend tolerates fields the backend adds.
- **NEXT-REL-03: Session data in the store is compatible across one release** (REL-ZD-03). During a rolling deployment the instances of N-1 and N read and write the same Redis or Postgres sessions (NODE-BFF-03). A change to the stored session shape is additive, or the reader accepts both shapes for one release; a removed field is dropped one release after nothing reads it. A session the new code cannot read ends that session (the user logs in again), never a 500.

### Build and image

- **NEXT-REL-04: The build uses `output: 'standalone'` and the image starts `node server.js` directly** (*verified*). The standalone output (`.next/standalone/`) contains `server.js`, the traced server files and a reduced `node_modules`; it does not contain `.next/static/`, which the image build copies next to it. The process is never started through `next start`, `npm start` or a shell, so `node` is PID 1 and receives SIGTERM. `npm run start` (`node .next/standalone/server.js`) exists for scripts only and needs `.next/static` copied the same way (the E2E server script does this).
- **NEXT-REL-05: Next.js images are built with the Dockerfile of NEXT-REL-06, not with Buildpacks.** This is a stack-level exception to REL-IMG-02, decided in the baseline: no product ADR is needed, and the product's chapter 7 names this rule as the reason. Reasons: the Paketo Node.js buildpack's Node 26 does not start on the Paketo run images (`libatomic.so.1` missing, found on 2026-11-20), and Paketo builds in place, so sources and tests end up in the image instead of only the standalone output (REL-IMG-01). Buildpacks for Next.js itself were not tried. Chapter 11 tracks the return to Buildpacks for the Node stacks.
- **NEXT-REL-06: The Dockerfile is multi-stage, from the lockfile, on distroless, pinned by digest** (*verified*, including the `GIT_COMMIT` argument). Build stage `node:26-trixie-slim@sha256:…` runs `npm ci` and `npm run build` (which runs `generate:api` first); the final stage is `gcr.io/distroless/nodejs26-debian13:nonroot@sha256:…` (no shell, no npm) and copies only `.next/standalone` and `.next/static`. The template has no `public/` folder; a product that adds one (for example `public/.well-known/security.txt`, NODE-BFF-09) copies it into the build stage and adds `COPY --from=build /app/public ./public` to the final stage, because the standalone output does not contain it. `USER 65532:65532`, command in exec form. Labels per REL-RUN-07 come from `--label` at build time. The update automation bumps both digests (REL-IMG-03, TS-TOOL-15).

```dockerfile
FROM node:26-trixie-slim@sha256:<digest> AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json next.config.ts orval.config.ts ./
COPY scripts/copy-api-spec.mjs ./scripts/
# the backend's spec, copied into the build context by CI (`npm run copy:api-spec`) before `docker build`
COPY openapi ./openapi
COPY messages ./messages
COPY src ./src
ENV NEXT_TELEMETRY_DISABLED=1
# commit SHA for deploymentId and the public config (NEXT-REL-15/17); not a secret
ARG GIT_COMMIT
RUN npm run build

FROM gcr.io/distroless/nodejs26-debian13:nonroot@sha256:<digest>
WORKDIR /app
ARG GIT_COMMIT=unknown
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 GIT_COMMIT=${GIT_COMMIT}
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER 65532:65532
EXPOSE 3000
# the distroless entrypoint is node; node is PID 1
CMD ["server.js"]
```

  **The OpenAPI spec is copied into the build context before `docker build`.** The backend owns the spec (`backend/openapi/*.yaml`, TS-API-01), but the image is built with `frontend/` as its context, which cannot reach `../backend`. `npm run copy:api-spec` (`scripts/copy-api-spec.mjs`, no dependencies) copies every `*.yaml` from `../backend/openapi` (or `API_SPEC_SOURCE`) into `frontend/openapi/` and removes specs the backend dropped; `frontend/openapi/` is gitignored in a product repository. `generate:api` runs it first, so `dev`, `test`, `build` and `verify` always generate from the backend's current spec; CI runs `npm run copy:api-spec` (or `verify`) in `frontend/` before `docker build`, and the Dockerfile keeps `COPY openapi ./openapi`. Inside the build stage, and in a separate frontend repository that commits its copy of the spec, `../backend/openapi` does not exist and the script leaves `openapi/` as it is. *Verified* in a copy of the template: `docker build` with the copied spec, and the script against a probe `backend/openapi` (copy, stale spec removed, empty source fails).

- **NEXT-REL-07: `.dockerignore` keeps tests, secrets and build output out of the build context:** `node_modules`, `.next`, `.env*`, `coverage`, `playwright-report`, `test-results`, logs, `e2e`, `test`, `**/*.spec.ts`, `**/*.spec.tsx`, `src/testing`. The spec exclusion is required, not cosmetic: `next build` type-checks every file the `tsconfig.json` includes, and the image build failed on spec-only types until the specs were excluded (*verified*).
- **NEXT-REL-08: Nothing environment-specific or secret enters the build** (REL-IMG-01, CFG-02/05, SEC-INC-01). No build argument or `ENV` carries a secret; no `.env*` file reaches the build (NEXT-REL-07); no `NEXT_PUBLIC_*` variable is set for a per-environment value, because Next.js inlines it into client and server chunks at build time (*verified*; NEXT-CFG). `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is not set at build time: setting it embeds it in the image as well. The per-build key Next.js generates is stored in `.next/server/server-reference-manifest.json` inside the image and is treated as public (NEXT-SEC; NEXT-REL-18).
- **NEXT-REL-09: The image's contents are known and measured.** The scratch image was 305 MB: 243 MB distroless base, 46 MB standalone output. Two things ship that the app does not use in production, both accepted:
  - `sharp` and `@img` (libvips, 19 MB) are traced into the standalone output although `images.unoptimized` is set. Excluding them with `outputFileTracingExcludes` is the preferred fix (*to verify before first use*: the build still starts and no route imports `sharp`).
  - msw and `@faker-js/faker` are bundled into the server chunks, because the test stubs are one build with the production code (NEXT-D5; started only under the guard of NEXT-DEV-05 and NEXT-CFG).

  Record the measured size in chapter 7; a jump in size in the release record is a signal to check the trace.
- **NEXT-REL-10: The heap is sized from the memory limit:** the deployment sets `NODE_OPTIONS=--max-old-space-size=<75 % of the limit in MiB>`, tuned from measurements (REL-RUN-03/05). Not measured for Next.js yet.

### Runtime

- **NEXT-REL-11: The container runs with a read-only root filesystem and no writable path** (REL-RUN-01/02). *Verified:* `docker run --read-only --cap-drop ALL --security-opt no-new-privileges` without any tmpfs; login, server-rendered pages and the API proxy worked, no `EROFS`. This holds because nothing writes to `.next/cache` at runtime:
  - `images: { unoptimized: true }` in `next.config.ts` (the image optimizer writes its cache to disk);
  - no ISR and no time-based or on-demand revalidation (`revalidate`, `revalidatePath`, `revalidateTag`), which write regenerated pages to disk; dynamic rendering by default (NEXT-D3);
  - static prerendered pages are read only and stay allowed.

  A feature that needs any of these needs an ADR with a shared cache handler (not a writable volume per instance). A product may still mount a size-limited `/tmp` for libraries that need one. Server actions inside the container were not exercised (*to verify before first use*).
- **NEXT-REL-12: Termination: pre-stop delay, then SIGTERM, grace period above both** (REL-ZD-02, REL-RUN-06). *Verified behaviour of the standalone server:* on SIGTERM it closes the listener at once (new connections are refused), lets in-flight requests finish, and exits with code 143. It has no drain timeout of its own and its readiness probe cannot report `DOWN` first, because the listener is already closed. Therefore:
  - the platform waits before sending SIGTERM (pre-stop delay, default 10 s), so the load balancer stops routing to the instance while it still serves; distroless has no `sleep` binary, so use the platform's built-in delay (Kubernetes: the `sleep` lifecycle action);
  - the grace period is at least pre-stop delay + the longest request (bounded by the request time-outs of NEXT-RES) + a margin; a hanging request ends with SIGKILL at the end of the grace period;
  - exit code 143 after SIGTERM is the normal end, not a failure; monitoring does not alert on it.
- **NEXT-REL-13: `HOSTNAME=0.0.0.0` and `PORT` are set in the image**, because the standalone server binds to `HOSTNAME`. A platform that sets `HOSTNAME` to the pod or container name overrides the image value; the deployment then sets `HOSTNAME=0.0.0.0` explicitly (*to verify before first use* on the product's platform: the probe reaches the instance on its pod address).

```yaml
spec:
  terminationGracePeriodSeconds: 35        # pre-stop 10 s + longest request 15 s (ingress, NEXT-RES-03) + flush 5 s + margin (NEXT-REL-12, NEXT-OBS-12)
  containers:
    - name: frontend
      image: registry.example.com/shop/frontend@sha256:…
      env: [{ name: HOSTNAME, value: "0.0.0.0" }]   # NEXT-REL-13
      securityContext:
        readOnlyRootFilesystem: true       # no tmpfs needed (NEXT-REL-11)
        allowPrivilegeEscalation: false
        capabilities: { drop: ["ALL"] }
      lifecycle:
        preStop: { sleep: { seconds: 10 } } # no shell in distroless
```

### Versions and promotion

- **NEXT-REL-14: One image per commit, promoted unchanged by digest** (REL-CD-01, CFG-02). Per-environment values reach the server as configuration at run time (NEXT-CFG: validated server env, public subset passed to the client), never through a rebuild. `package.json` `version` stays `0.0.0`.
- **NEXT-REL-15: The release version is injected at deploy time; the commit is built in** (REL-VER-05). `RELEASE_VERSION` (default `unreleased`) is a server configuration key, logged once at start and set as `service.version` in `OTEL_RESOURCE_ATTRIBUTES`. The commit comes from CI as a build argument (`--build-arg GIT_COMMIT=<sha>`, not a secret) and is read in `next.config.ts` (it sets `deploymentId`, NEXT-REL-17); the server logs it at start. Both values go to the client in the public configuration, so client error reports name what ran (REACT-OBS-05). The runtime stage of the Dockerfile sets `ENV GIT_COMMIT` from the same build argument, and the server configuration reads it (*verified*: the image logged the commit at start).

### Rolling deployments and version skew (REL-ZD-04)

During a rolling deployment a browser that loaded a page from N-1 may reach an instance of N and the reverse. Three things can break: static chunks, client navigation (RSC payloads) and server actions.

- **NEXT-REL-16: The image contains the previous release's static files.** The image build adds `.next/static` of the latest release under the current one (current files win), taken from that release's static artifact; the pipeline keeps that artifact until the next release ships, and the first release starts empty. Only the latest release's files are added, so the folder does not grow per release. *Verified:* the standalone server serves any file placed under `.next/static/` with `Cache-Control: public, max-age=31536000, immutable`, and answers a missing chunk with `404` (`text/plain`), never with HTML. An instance of N-1 cannot serve N's new chunks; NEXT-REL-17 covers that case.
- **NEXT-REL-17: `deploymentId` is set to the commit SHA** (`deploymentId: process.env['GIT_COMMIT']` in `next.config.ts`, or `NEXT_DEPLOYMENT_ID`). Per the Next.js documentation, Next.js then tags its asset and navigation requests with the deployment id and turns a client navigation into a full page load when client and server ids differ. *To verify before first use* (option names verified in `next/dist`, behaviour not tested): a browser on N-1 navigating against N does one full load and lands on N; a chunk that fails to load leads to one full reload, not a broken screen.
- **NEXT-REL-18: Server actions of N-1 fail on N, and the client reloads once.** Action IDs stay the same across rebuilds only while `.next/cache` exists; CI builds clean (TS-TOOL-16), so the IDs change with every build (*verified*). The per-build encryption key is public (NEXT-REL-08), so no action relies on encrypted bound arguments or closures for security (NEXT-SEC). The outgoing adapter that calls a server action (`adapter/out/next/`) treats an unknown-action failure as a release change: it does one full page reload, guarded against loops (at most one reload per release version and tab, kept in `sessionStorage`), and the user repeats the action on the new page. Anything else maps to the feature's error as usual. *To verify before first use:* the error an N-1 client gets for an unknown action ID in Next.js 16.4, and whether Next.js reloads by itself.
  *Why:* a rolling deployment of a few minutes is enough for a user to submit a form from an old page; one reload is the honest recovery.

### Supply chain (SEC-CI-03, SEC-CI-06)

- **NEXT-REL-19: The release job publishes two SBOMs:** the CycloneDX SBOM of the image from the pipeline's image scanner, and the dependency SBOM of TS-TOOL-16 (`@cyclonedx/cyclonedx-npm --omit dev`). Bundled code has no `package.json` inside the image, so the image scanner sees only the packages in the standalone `node_modules`; the npm SBOM is the complete list. Because msw and `@faker-js/faker` ship in the server chunks (NEXT-REL-09), they are listed under `dependencies`, not `devDependencies`, so `--omit dev` keeps them in the SBOM.
- **NEXT-REL-20: The image is scanned like every image** (SEC-CI-06): in the integration build, as a release gate, and on a schedule for deployed digests. Findings in `sharp`/libvips are fixed by removing them (NEXT-REL-09), not by an accepted risk.
- **NEXT-REL-21: The `e2e:smoke` tier and the configuration smoke test start the image as production does** (REPO-CI-04, TEST-CFG-02): read-only, all capabilities dropped, only the required keys of `configuration-keys.yaml`, test stubs off. The manual start of the template image that way (secret as a mounted file, `/livez` and `/readyz` UP against Redis, `/readyz` DOWN without it, `APP_TEST_STUBS=1` refused with exit code 1) is *verified*; the automated smoke tier ([testing/nextjs.md](../08-crosscutting-concepts/testing/nextjs.md)) is *to verify before first use*.

## Anti-patterns

- `next start` or `npm start` as the container command, or a `sh -c` wrapper that swallows SIGTERM.
- A `NEXT_PUBLIC_API_URL` per environment and one image build per environment.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` as a build argument "so the IDs stay stable".
- A writable volume for `.next/cache` so ISR or the image optimizer works.
- Copying every old release's `.next/static` forward, so the image grows with each release.
- A `frontend/` bundle copied into the backend image, or a `backend/v…` tag that also releases the Next.js app.

*Agent checklist in [checklists/nextjs.md](../checklists/nextjs.md) and sources in [sources.md](../sources.md), section "Next.js: Delivery".*
