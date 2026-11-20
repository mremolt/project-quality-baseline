# 7. Deployment View

Where the code lives and how it is built, released and run, as far as the baseline prescribes it. Production infrastructure (clusters, networks, environments) is product-specific and belongs in the product's chapter 7. The application side of running software is in chapter 8: configuration and environments ([configuration](../08-crosscutting-concepts/configuration/configuration.md)), probes, graceful shutdown and telemetry ([observability](../08-crosscutting-concepts/observability/observability.md)).

| Doc | Covers | Rule IDs |
|---|---|---|
| [repository-layout.md](repository-layout.md) | One repo per product, component folders, subfolder tooling, CI, decision guide for separate repos | `REPO-*` |
| [delivery-and-release.md](delivery-and-release.md) | Branching, versioning, changelog, CD stages, handover, delivery platform mapping, migrations at deploy time, zero downtime, rollback, feature flags | `REL-BR/VER/CD/DB/ZD/RB/FF-*` |
| [container-runtime.md](container-runtime.md) | Image build as a capability (Buildpacks default), frontend delivery in the BFF image, container runtime contract with Kubernetes and Compose examples | `REL-IMG-*`, `REL-FE-*`, `REL-RUN-*` |
| [spring-local-development.md](spring-local-development.md) | Docker Compose, profiles, JDK, running a Spring service against local services | `SPRING-DEV-*` |
| [spring-delivery.md](spring-delivery.md) | Flyway roles, lock timeout and retry, pre-deploy migration job, release version injected at deploy time, bundle embedded in the BFF | `SPRING-REL-*` |
| [nestjs-local-development.md](nestjs-local-development.md) | Docker Compose, Node version, watch mode, running a NestJS service against local services | `NEST-DEV-*` |
| [nestjs-delivery.md](nestjs-delivery.md) | Kysely migrations at start-up or as a pre-deploy job, DDL user, release version, image build, bundle embedded in the BFF | `NEST-REL-*` |
| [nextjs-local-development.md](nextjs-local-development.md) | Docker Compose for the session store, dev server, stubbed backend and IdP | `NEXT-DEV-*` |
| [nextjs-delivery.md](nextjs-delivery.md) | Next.js as its own image and BFF: standalone build, Dockerfile, read-only filesystem, version skew, own release unit | `NEXT-REL-*` |

The CI system, registry, runtime platform and secret store are usually the customer's. These docs name capabilities and reference tools; each product records its realisation in the delivery platform mapping of its chapter 7 (REL-CD-06, template `templates/arc42/07-deployment-view.md`). Images are built with Buildpacks by default (REL-IMG-02; Spring: SPRING-LIB-13). NestJS services and Next.js apps use a Dockerfile instead (NEST-REL-07, NEXT-REL-*). A React SPA is delivered like an Angular one, inside the BFF image (REL-FE-*); a Next.js app is its own image and the BFF.
