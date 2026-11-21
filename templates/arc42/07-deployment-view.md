# 7. Deployment View

Repository layout, CI, delivery, images and local development follow the baseline: [../baseline/07-deployment-view](../baseline/07-deployment-view/README.md). This chapter records how this product realises them. Every section is filled in or says in one line why it does not apply (DOC-ARC-07).

## 7.1 Infrastructure

<!-- Platform, network zones, mapping of components to runtime units (C4 deployment view as Mermaid, DOC-ARC-05). -->

## 7.2 Environments

<!-- REL-CD-02: the environments this product uses and who deploys each (REL-CD-05). -->

| Environment | Purpose | Deployed by | Notes |
|---|---|---|---|
| test | | pipeline | |
| staging | | pipeline | |
| production | | pipeline after approval / customer from the handover package | |

## 7.3 Delivery platform mapping

<!-- Mandatory (REL-CD-06). Name the concrete tool or setting for each capability. A capability the platform
     cannot provide goes to chapter 11 with its compensating measure. -->

| Capability | Baseline rule | This product |
|---|---|---|
| SCM host, branch protection as checked configuration, CODEOWNERS | REL-BR-02, REL-BR-05 | |
| CI system; change detection; always-reported merge status | REPO-CI-01..03 | |
| Container registry; release tag on the existing digest | REL-CD-01 | |
| Image build method (Buildpacks default; Dockerfile or Jib with the platform reason) | REL-IMG-02 (Spring: SPRING-LIB-13, SPRING-SEC-29; NestJS: NEST-REL-07; Next.js: NEXT-REL-05) | |
| Image scanner (report at integration, gate at release, scheduled re-scan) | SEC-CI-06 | |
| Dependency, secret and static analysis scanners | SEC-CI-01 | |
| SBOM, provenance signing and verification before deploy | SEC-CI-03, SEC-CI-07 | |
| Dependency update automation | TS-TOOL-15 | |
| Runtime platform (orchestrator, PaaS, VMs) | REL-RUN-* | |
| Secret store and mount mechanism (mount path) | CFG-05 (Spring: SPRING-CFG-07; NestJS: NEST-CFG-07; Next.js: NEXT-CFG-06) | |
| Production approval mechanism | REL-CD-03 | |
| Who deploys each environment; handover channel | REL-CD-02, REL-CD-05 | |
| Migration variant (start-up default, or pre-deploy job with the same image) | REL-DB-01 | |
| Probe realisation: (a) `/livez`, `/readyz` on the main port, not routed by the ingress (default), or (b) management-port probes plus a platform check of the serving port | OBS-19 (Spring: SPRING-OBS-01; NestJS: NEST-OBS-01; Next.js: NEXT-OBS-11) | |
| Termination grace period and pre-stop delay (above the shutdown budget) | OBS-04 (Spring: SPRING-OBS-04; NestJS: NEST-OBS-04; Next.js: NEXT-OBS-12), REL-RUN-06 | |
| Log and metric export (structured stdout logs; OTLP push or Prometheus pull) | Spring: SPRING-LIB-10; NestJS: NEST-OBS-05; Next.js: NEXT-OBS-01 | |
| Frontend delivery (default: bundle in the BFF image; a Next.js frontend is its own image, NEXT-D2; otherwise the ADR) | REL-FE-01 | |

## 7.4 Configuration keys and secret sources

<!-- CFG-10, CFG-12, TEST-CFG-02: the keys are listed once, machine-readable, in each component's
     configuration-keys.yaml. Do not copy them here; link the files and add what differs per environment. -->

| Component | Key list | Secret source per environment |
|---|---|---|
| backend | [`backend/configuration-keys.yaml`](../../backend/configuration-keys.yaml) | |

## 7.5 Rollout, availability and recovery

<!-- REL-ZD-01, REL-RUN-03/04, REL-CD-07, REL-RB-04/05. -->

| Topic | Value |
|---|---|
| Instances per backend in production; rolling or other strategy (REL-ZD-01; single instance: accepted downtime) | |
| Resources per container: CPU request/limit, memory request = limit (REL-RUN-03) | |
| Start-up budget vs. measured start incl. migration and lock wait (REL-RUN-04, REL-DB-03/04) | |
| Pipeline times: required PR status, merge to `test` (REL-CD-07) | |
| Rollback drill: last date and result (REL-RB-04) | |

| Data store | RPO | RTO | Backups by | Restore tested by, last date (REL-RB-05) |
|---|---|---|---|---|
| | | | | |

## 7.6 Timeouts and capacity

Timeout ladder ([RES-TMO-04](../baseline/08-crosscutting-concepts/resilience/resilience.md)): each rung shorter than the one above. Outbound calls: connect + read × attempts + backoff fit the request budget.

| Rung | Value | Where it is set |
|---|---|---|
| Gateway / ingress read timeout | 15 s | <!-- platform setting --> |
| Request budget | 10 s | design value, enforced by the rungs below |
| Transaction timeout | 5 s | <!-- e.g. Spring: `spring.transaction.default-timeout`; NestJS: `transaction_timeout` in the pool options --> |
| Statement timeout | 3 s | <!-- e.g. Spring: `connection-init-sql`; NestJS: `statement_timeout` in the pool options --> |

| Dependency | Connect | Read | Attempts | Total retry time | Concurrency limit |
|---|---|---|---|---|---|
| | | | | | |

Database connections ([RES-CAP-02](../baseline/08-crosscutting-concepts/resilience/resilience.md)): (maximum instances + rolling-deployment surge) × pool size + other users + reserve < database connection limit.

| Max instances | Surge | Pool size | Other users (jobs, tools, other services) | Reserve | Database limit | Result |
|---|---|---|---|---|---|---|
| | | | | | | |
