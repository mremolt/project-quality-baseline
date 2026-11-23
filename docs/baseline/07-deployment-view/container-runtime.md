# Container Images, Frontend Delivery and Runtime Contract

What every deployable ships as and what it expects from the platform it runs on: how images are built, how the frontend bundle reaches the browser, and the runtime contract between the container and the platform. The platform itself (Kubernetes, a PaaS, Compose on a VM, the customer's orchestrator) is the product's or the customer's; the rules name capabilities, and the examples show Kubernetes and Docker Compose. Each product records its realisation in the delivery platform mapping of its chapter 7 (REL-CD-06). Spring specifics: [spring-delivery.md](spring-delivery.md) and SPRING-LIB-13; NestJS: [nestjs-delivery.md](nestjs-delivery.md); Next.js: [nextjs-delivery.md](nextjs-delivery.md).

## Rules

### Image build

- **REL-IMG-01: Every deployable ships as an OCI image built once per commit in the pipeline** (REL-CD-01). The image:
  - runs as a non-root user with a numeric UID;
  - starts from a minimal base image pinned by digest (no shell or package manager where the stack allows it);
  - contains no build tools, sources, test dependencies or secrets in any layer, and no secret is passed as a build argument (SEC-INC-01);
  - comes with an SBOM generated for the image (SEC-CI-03) and the labels of REL-RUN-07.
- **REL-IMG-02: Cloud Native Buildpacks are the default build method** (Spring: SPRING-LIB-13; NestJS and Next.js use a Dockerfile as a stack-level exception, NEST-REL-07, NEXT-REL-05). A Dockerfile-based build (multi-stage) or Jib is allowed **without an ADR** when the customer platform dictates it, for example no container daemon in CI, a mandated base image or a mandated build service. The product records the method and the reason in the delivery platform mapping of its chapter 7. Any other reason for leaving the default needs an ADR. Whatever the method, REL-IMG-01 holds.
- **REL-IMG-03: Base and builder images stay current.** They are pinned by digest and updated by the update automation (TS-TOOL-15), which rebuilds the image; deployed images are re-scanned on a schedule (SEC-CI-06).

### Frontend delivery (default: the BFF serves the bundle)

- **REL-FE-01: The BFF image embeds and serves the frontend bundle.** The SPA and its API share one origin (the frontend's XSRF rule); the BFF is either the backend's additional filter chain or its own component (SPRING-SEC-09, NEST-SEC-13). **Documented alternative without ADR:** a frontend stack that renders on a server is its own image and is the BFF itself (Next.js, NEXT-D2); REL-FE-01..05 then do not apply, and its stack's delivery rules take their place (Per stack line at the end). Other topologies (a static file server container, a CDN or object storage, an ingress or gateway serving files) need an ADR, which states how REL-FE-02..05, CFG-11 and the frontend's CSP nonce rule are met there.
  *Why:* one origin, one image and one digest per release; the CSP nonce, `/config.json` and the session cookie come from the same server without extra infrastructure.
- **REL-FE-02: The bundle reaches the BFF image as a pipeline artifact, not through a cross-component build** (REPO-LAY-04). The frontend job builds the bundle once per commit (`npm run build`) and hands the output folder to the BFF's image build job, which passes it to the build as a parameter (Spring: SPRING-REL-08; NestJS: NEST-REL-10). The BFF's own `verify` does not need the frontend: its serving tests use a small fixture bundle. Locally, the frontend dev server proxies to the BFF (Angular: NG-CFG-06; React SPA: REACT-CFG-06), so nobody builds an image to develop.
- **REL-FE-03: The BFF serves the bundle with fixed rules:**

  | Request | Response |
  |---|---|
  | `GET /` and deep links (a `GET` that accepts `text/html` and matches no API, login, actuator or file path) | `index.html` with the per-request CSP nonce (the frontend's CSP rule), `Cache-Control: no-store`. The nonce templating is tested against the `index.html` of a real production build: the build tools already mark tags with the placeholder, and a stub hides duplicates or misses |
  | Hashed files (`*-<hash>.js`, `.css`, fonts, media) | `Cache-Control: public, max-age=31536000, immutable` |
  | Unhashed public files (`favicon.ico`, `/.well-known/security.txt`) | short cache (`max-age` of minutes) |
  | `GET /config.json` | generated per environment, not cached (CFG-11, SPRING-CFG-10, NEST-CFG-11) |
  | A missing file, or an API path that does not exist | `404`, never `index.html` |

  *Why:* serving `index.html` for a missing chunk turns a clean load error into a JavaScript syntax error that the reload of REL-FE-04 cannot catch.
- **REL-FE-04: During a rolling deployment both releases' chunks can be loaded** (REL-ZD-04). An instance of version N cannot serve the hashed files of N-1 by itself, and an old instance cannot serve N's. Therefore:
  - the image build adds the hashed files of the previous release's bundle to the current bundle (current files win; `index.html` only from the current build), taken from the previous release's bundle artifact or image, so the pipeline keeps the bundle artifact of every release until the next one ships;
  - the frontend handles a failed lazy chunk load with one full page reload, guarded against reload loops (for example at most one reload per release version in a session). A browser that reaches an older instance after the reload gets that instance's consistent `index.html`.
- **REL-FE-05: The frontend embedded in the BFF is part of the BFF's release.** There is one tag for both, in the BFF's format (`backend/v1.4.0`, or `backend-bff/v…` for a separate BFF component, REPO-CI-05); no `frontend/v…` tags exist while the frontend ships only inside the BFF image. The release tool derives the version and changelog from commits in both folders (REL-VER-03), and the changelog lives in the BFF's folder. A frontend delivered on its own (by ADR, REL-FE-01) gets its own tag.
- **REL-FE-06: A BFF that should serve the bundle refuses to start without it.** In a deployed environment a missing `index.html` in the bundle folder ends the start (exit code 1, the configuration key in the message); a run without a bundle is an explicit setting (an API-only deployment), never the fallback. The image build job also starts the built image once and asserts `GET /` answers `200` with `text/html` and `GET /config.json` answers `200`.
  *Why:* a bundle-less image passes `/livez` and `/readyz` and answers `404` to every user, so only the users notice. A smoke test of the probes alone cannot tell.

### Runtime contract

Kubernetes and Compose examples follow the rules. The product's chapter 7 records the actual values. The runtime contract applies to every installation the product delivers, including a Compose file that customers or a demo audience run on their own machine (REL-CD-08). "Local" here means the developer's inner loop (`compose.yaml` for dependencies), not a deliverable.

- **REL-RUN-01: Containers run without privileges:** non-root (REL-IMG-01), no privilege escalation, all Linux capabilities dropped, no host paths, host network or host ports beyond what the platform's ingress needs.
- **REL-RUN-02: The root filesystem is read-only.** The only writable path is a size-limited ephemeral `/tmp` (or the stack's equivalent). The container keeps no state that must survive a restart; data lives in the database or an object store.
  *Why:* a read-only filesystem stops an attacker from dropping tools or changing code, and makes "works until the pod restarts" bugs impossible.
- **REL-RUN-03: Every container has resource bounds.** A memory limit is always set, and the memory request equals it (SHOULD); a CPU request is always set, and a CPU limit follows the platform's policy. Values come from load tests and are recorded in chapter 7, with the instance counts that the connection pool calculation (RES-CAP-02) uses.
- **REL-RUN-04: The platform's start-up budget covers the worst-case start.** The budget (Kubernetes: `startupProbe` period × failure threshold; elsewhere the platform's start timeout) is at least the measured start time plus the start-up migration and its lock wait (REL-DB-03/04). Liveness checks do not run before start-up finished. The product records the budget and the measured start in chapter 7.
- **REL-RUN-05: The JVM heap is derived from the container's memory limit**, as a percentage, never a fixed `-Xmx` chosen without the limit in view. Heap plus metaspace, thread stacks, direct and native memory stay below the limit. Buildpacks' memory calculator does this; with a Dockerfile or Jib set `-XX:MaxRAMPercentage` (75 as a starting point, tuned from measurements). An out-of-memory kill by the platform is visible in monitoring (OBS). Node.js images apply the same rule to the V8 heap with `--max-old-space-size` (NEST-REL-08, NEXT-REL-10).
- **REL-RUN-06: The platform's termination grace period is longer than the application's shutdown budget** plus any pre-stop delay plus a margin (OBS-04, Spring: SPRING-OBS-04; NestJS: NEST-OBS-04).
- **REL-RUN-07: Images carry OCI labels** `org.opencontainers.image.source` (repository URL), `org.opencontainers.image.revision` (commit SHA) and `org.opencontainers.image.title`. The release version is not a label, because it is attached after the build (REL-CD-01). A creation timestamp only if the build sets it reproducibly (TS-TOOL-16, JAVA-TOOL-23).

- **REL-RUN-08: A feature that depends on what the image provides beyond the runtime (fonts, AWT, native libraries, locale data, CA certificates) is exercised against the real image.** Minimal and distroless images have no fontconfig, no fonts and few native libraries; code that renders files works on every developer machine and in every test and fails only in the container. Prefer libraries that need none of it (embedded fonts, no AWT); otherwise the smoke tier runs one scenario of the feature against the built image (EXP-08).

### Example: Kubernetes

```yaml
spec:
  terminationGracePeriodSeconds: 40          # > shutdown budget + pre-stop delay (REL-RUN-06)
  securityContext:
    runAsNonRoot: true
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: backend
      image: registry.example.com/orders/backend@sha256:…   # by digest (REL-CD-01)
      securityContext:
        readOnlyRootFilesystem: true          # REL-RUN-02
        allowPrivilegeEscalation: false       # REL-RUN-01
        capabilities: { drop: ["ALL"] }
      resources:                              # REL-RUN-03
        requests: { cpu: 500m, memory: 1Gi }
        limits: { memory: 1Gi }
      startupProbe:                           # REL-RUN-04: 36 × 5 s = 180 s ≥ start + migration + lock wait
        httpGet: { path: /livez, port: http }   # serving port by default (OBS-19, Spring: SPRING-OBS-01; NestJS: NEST-OBS-01)
        periodSeconds: 5
        failureThreshold: 36
      volumeMounts: [{ name: tmp, mountPath: /tmp }]
  volumes:
    - name: tmp
      emptyDir: { sizeLimit: 256Mi }
```

### Example: Docker Compose

```yaml
services:
  backend:
    image: registry.example.com/orders/backend@sha256:…
    read_only: true                            # REL-RUN-02
    tmpfs: ["/tmp:size=256m"]
    security_opt: ["no-new-privileges:true"]   # REL-RUN-01
    cap_drop: ["ALL"]
    mem_limit: 1g                              # REL-RUN-03
    cpus: 1.0
    stop_grace_period: 40s                     # REL-RUN-06
```

Compose has no start-up budget of its own; whoever operates it records how a failed start is detected.

## Anti-patterns

- A Dockerfile that copies the whole repository, runs the build inside the image and keeps Maven, npm and the sources in the final layer.
- `FROM eclipse-temurin:latest` or any base image by tag only.
- An nginx container next to the BFF "just for the static files", without an ADR, so the CSP nonce and `/config.json` need a second server.
- A catch-all route that returns `index.html` for `/main-abc123.js` after a deployment.
- `-Xmx4g` in a container with a 2 GiB limit, or no memory limit at all.
- A start-up probe tuned for a fast start, so the first deployment with a long migration is killed in a restart loop.
- The release version written into an image label or into the bundle at build time.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Container Images, Frontend Delivery and Runtime Contract".*
