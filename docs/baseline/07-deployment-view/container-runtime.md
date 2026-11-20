# Container Images, Frontend Delivery and Runtime Contract

What every deployable ships as and what it expects from the platform it runs on: how images are built, how the frontend bundle reaches the browser, and the runtime contract between the container and the platform. The platform itself (Kubernetes, a PaaS, Compose on a VM, the customer's orchestrator) is the product's or the customer's; the rules name capabilities, and the examples show Kubernetes and Docker Compose. Each product records its realisation in the delivery platform mapping of its chapter 7 (REL-CD-06). Spring specifics: [spring-delivery.md](spring-delivery.md) and SPRING-LIB-13.

## Rules

### Image build

- **REL-IMG-01: Every deployable ships as an OCI image built once per commit in the pipeline** (REL-CD-01). The image:
  - runs as a non-root user with a numeric UID;
  - starts from a minimal base image pinned by digest (no shell or package manager where the stack allows it);
  - contains no build tools, sources, test dependencies or secrets in any layer, and no secret is passed as a build argument (SEC-INC-01);
  - comes with an SBOM generated for the image (SEC-CI-03) and the labels of REL-RUN-07.
- **REL-IMG-02: Cloud Native Buildpacks are the default build method** (Spring: SPRING-LIB-13). A Dockerfile-based build (multi-stage) or Jib is allowed **without an ADR** when the customer platform dictates it, for example no container daemon in CI, a mandated base image or a mandated build service. The product records the method and the reason in the delivery platform mapping of its chapter 7. Any other reason for leaving the default needs an ADR. Whatever the method, REL-IMG-01 holds.
- **REL-IMG-03: Base and builder images stay current.** They are pinned by digest and updated by the update automation (TS-TOOL-15), which rebuilds the image; deployed images are re-scanned on a schedule (SEC-CI-06).

### Frontend delivery (default: the BFF serves the bundle)

- **REL-FE-01: The BFF image embeds and serves the frontend bundle.** The SPA and its API share one origin (NG-SEC-07); the BFF is either the backend's additional filter chain or its own component (SPRING-SEC-09). Other topologies (a static file server container, a CDN or object storage, an ingress or gateway serving files) need an ADR, which states how REL-FE-02..05, CFG-11 and NG-SEC-06 are met there.
  *Why:* one origin, one image and one digest per release; the CSP nonce, `/config.json` and the session cookie come from the same server without extra infrastructure.
- **REL-FE-02: The bundle reaches the BFF image as a pipeline artifact, not through a cross-component build** (REPO-LAY-04). The frontend job builds the bundle once per commit (`npm run build`) and hands the output folder to the BFF's image build job, which passes it to the build as a parameter (Spring: SPRING-REL-08). The BFF's own `verify` does not need the frontend: its serving tests use a small fixture bundle. Locally, the Angular dev server proxies to the BFF (NG-CFG-06), so nobody builds an image to develop.
- **REL-FE-03: The BFF serves the bundle with fixed rules:**

  | Request | Response |
  |---|---|
  | `GET /` and deep links (a `GET` that accepts `text/html` and matches no API, login, actuator or file path) | `index.html` with the per-request CSP nonce (NG-SEC-06), `Cache-Control: no-store` |
  | Hashed files (`*-<hash>.js`, `.css`, fonts, media) | `Cache-Control: public, max-age=31536000, immutable` |
  | Unhashed public files (`favicon.ico`, `/.well-known/security.txt`) | short cache (`max-age` of minutes) |
  | `GET /config.json` | generated per environment, not cached (CFG-11, SPRING-CFG-10) |
  | A missing file, or an API path that does not exist | `404`, never `index.html` |

  *Why:* serving `index.html` for a missing chunk turns a clean load error into a JavaScript syntax error that the reload of REL-FE-04 cannot catch.
- **REL-FE-04: During a rolling deployment both releases' chunks can be loaded** (REL-ZD-04). An instance of version N cannot serve the hashed files of N-1 by itself, and an old instance cannot serve N's. Therefore:
  - the image build adds the hashed files of the previous release's bundle to the current bundle (current files win; `index.html` only from the current build), taken from the previous release's bundle artifact or image, so the pipeline keeps the bundle artifact of every release until the next one ships;
  - the frontend handles a failed lazy chunk load with one full page reload, guarded against reload loops (for example at most one reload per release version in a session). A browser that reaches an older instance after the reload gets that instance's consistent `index.html`.
- **REL-FE-05: The frontend embedded in the BFF is part of the BFF's release.** There is one tag for both, in the BFF's format (`backend/v1.4.0`, or `backend-bff/v…` for a separate BFF component, REPO-CI-05); no `frontend/v…` tags exist while the frontend ships only inside the BFF image. The release tool derives the version and changelog from commits in both folders (REL-VER-03), and the changelog lives in the BFF's folder. A frontend delivered on its own (by ADR, REL-FE-01) gets its own tag.

### Runtime contract

Kubernetes and Compose examples follow the rules. The product's chapter 7 records the actual values.

- **REL-RUN-01: Containers run without privileges:** non-root (REL-IMG-01), no privilege escalation, all Linux capabilities dropped, no host paths, host network or host ports beyond what the platform's ingress needs.
- **REL-RUN-02: The root filesystem is read-only.** The only writable path is a size-limited ephemeral `/tmp` (or the stack's equivalent). The container keeps no state that must survive a restart; data lives in the database or an object store.
  *Why:* a read-only filesystem stops an attacker from dropping tools or changing code, and makes "works until the pod restarts" bugs impossible.
- **REL-RUN-03: Every container has resource bounds.** A memory limit is always set, and the memory request equals it (SHOULD); a CPU request is always set, and a CPU limit follows the platform's policy. Values come from load tests and are recorded in chapter 7, with the instance counts that the connection pool calculation (RES-CAP-02) uses.
- **REL-RUN-04: The platform's start-up budget covers the worst-case start.** The budget (Kubernetes: `startupProbe` period × failure threshold; elsewhere the platform's start timeout) is at least the measured start time plus the start-up migration and its lock wait (REL-DB-03/04). Liveness checks do not run before start-up finished. The product records the budget and the measured start in chapter 7.
- **REL-RUN-05: The JVM heap is derived from the container's memory limit**, as a percentage, never a fixed `-Xmx` chosen without the limit in view. Heap plus metaspace, thread stacks, direct and native memory stay below the limit. Buildpacks' memory calculator does this; with a Dockerfile or Jib set `-XX:MaxRAMPercentage` (75 as a starting point, tuned from measurements). An out-of-memory kill by the platform is visible in monitoring (OBS).
- **REL-RUN-06: The platform's termination grace period is longer than the application's shutdown budget** plus any pre-stop delay plus a margin (OBS-04, Spring: SPRING-OBS-04).
- **REL-RUN-07: Images carry OCI labels** `org.opencontainers.image.source` (repository URL), `org.opencontainers.image.revision` (commit SHA) and `org.opencontainers.image.title`. The release version is not a label, because it is attached after the build (REL-CD-01). A creation timestamp only if the build sets it reproducibly (TS-TOOL-16, JAVA-TOOL-23).

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
        httpGet: { path: /livez, port: http }   # serving port by default (OBS-19, Spring: SPRING-OBS-01)
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

## Agent checklist

- [ ] New deployable or image change: non-root, minimal base pinned by digest, no build tools or secrets in layers, SBOM, labels (REL-IMG-01, REL-RUN-07)?
- [ ] Build method other than Buildpacks: customer platform reason recorded in chapter 7, or an ADR (REL-IMG-02)?
- [ ] Frontend change to serving, routing or caching: deep-link, cache-header and 404 rules kept; previous release's chunks still served (REL-FE-03/04)?
- [ ] Runtime settings: read-only filesystem, resource bounds, heap from the limit, start-up budget covers migrations, grace period above the shutdown budget; values recorded in chapter 7 (REL-RUN-*)?

## Sources

OCI Image Format Specification, annotations (github.com/opencontainers/image-spec). Cloud Native Buildpacks (buildpacks.io); Paketo image labels buildpack (`BP_OCI_*`) and JVM memory calculator (paketo.io). Kubernetes documentation: pod security standards, `securityContext`, resource management, startup probes, pod termination (kubernetes.io). Docker Compose file reference (docs.docker.com/compose). OpenJDK container support, `-XX:MaxRAMPercentage`. Angular deployment guide, server configuration for routed apps (angular.dev).
