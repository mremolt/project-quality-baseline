# 12. Glossary

| Term | Meaning |
|---|---|
| Adapter | Code that connects the application to the outside world. Incoming adapters (REST controller, Kafka listener, UI) call the core; outgoing adapters (JPA, HTTP client, producer) implement outgoing ports. See [adapters.md](../05-building-block-view/adapters.md) |
| ADR | Architecture Decision Record, `docs/adr/NNNN-title.md` in Nygard format (D6) |
| Application (ring) | Use-case implementations; orchestrate the domain through ports |
| arc42 | Template for architecture documentation in 12 chapters; used for this baseline and for every product's `docs/architecture/` |
| ASVS | OWASP Application Security Verification Standard, version 5.0; our requirement catalogue, level L2 by default (D14) |
| AsyncAPI | Specification format for event-driven interfaces (topics, payloads); our event contract format (MSG-CON-01) |
| BFF | Backend-for-frontend: holds the OIDC tokens for a browser app and gives it a session cookie (SPRING-SEC-08, NEST-SEC-12, NODE-BFF-01); a Next.js app is its own BFF |
| Bounded context | A part of the domain with its own model and language; contexts in one application meet only at incoming ports (ARCH-ORG-09) |
| Build once, promote | One artifact per component and commit is deployed unchanged to every environment; only configuration differs (CFG-02, REL-CD-01) |
| Caller | Framework-free record describing who triggered a use case (user id, roles), passed with the command; the use case authorizes with it (ARCH-UC-15, SPRING-SEC-02, NEST-SEC-02) |
| Chicago / London style | TDD styles: real collaborators (Chicago) vs. mocked collaborators (London) ([tdd.md](../08-crosscutting-concepts/testing/tdd.md)) |
| Command / Query / Result | Input (`…Command` changes state, `…Query` reads) and output (`…Result`) of one use case, validated on construction; the incoming port itself is the `…UseCase` ([use-cases.md](../05-building-block-view/use-cases.md)) |
| Component folder | Top-level folder of a product repository holding one deployable (`backend/`, `frontend/`) (REPO-LAY-03) |
| Composition root | The one place that wires adapters, ports and services (Spring: the `@SpringBootApplication` class; NestJS: the context module, NEST-ARCH-01; React: the feature's composition file, REACT-ARCH-10; Next.js: also the request-scoped server composition, NEXT-ARCH-03) |
| Controller / processor (GDPR) | The controller decides purpose and means of processing personal data; a processor processes it on the controller's behalf under a data processing agreement (AVV). See [data-protection.md](../08-crosscutting-concepts/data-protection/data-protection.md) |
| Conventional Commits | Commit message convention (`feat:`, `fix:`, `feat!:` …) used for squash-merge titles and generated changelogs (REL-BR-03) |
| Core | Domain + ports + application: everything inside the adapters ([hexagonal-architecture.md](../04-solution-strategy/hexagonal-architecture.md)) |
| CSP | Content Security Policy: response header restricting where scripts and other resources load from (NG-SEC-05) |
| Dead-letter topic (DLT) | Topic receiving messages a consumer cannot process; owned by the consuming team, with a replay procedure (MSG-DLT-01..03) |
| Deletion concept | Per product: for each personal-data category its storage locations, retention period, start event and deletion mechanism (Löschkonzept, DP-INV-02) |
| Domain (ring) | Entities, value objects, domain services and business exceptions; depends on nothing else |
| Domain event | Immutable fact in `domain`, named in the past tense, handed to an outgoing port and published through the outbox (ARCH-UC-14) |
| DPO | Data protection officer (DSB); decides legal questions such as legal basis and retention periods |
| Error category | Validation, business rule, not found, conflict or technical; decides how every adapter reports an error (ARCH-UC-13) |
| Event / command (message) | An event reports a fact that happened (past tense, many consumers); a command asks one receiver to do something (MSG-EVT-01) |
| Expand/contract | Migration technique: add the new form, migrate users, remove the old form in a later release (SPRING-DB-05, NEST-DB-20, REPO-API-02) |
| Feature flag | Runtime switch read through an outgoing port; release flags are temporary and have a removal date (REL-FF-01..04) |
| Hydration | React attaching event handlers to HTML that the server rendered; the client render must produce the same markup ([05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md)) |
| Idempotency key | Client-chosen key that makes a retried request or redelivered message have its effect only once (RES-IDM-01..05) |
| Liveness / readiness | Liveness: the process is alive and should not be restarted. Readiness: this instance can serve traffic now (OBS-01..03) |
| N+1 | One request or statement per item of a list instead of a bounded number ([avoiding-n-plus-one.md](../08-crosscutting-concepts/api/avoiding-n-plus-one.md)) |
| N-1 compatibility | Version N works with version N-1 on every boundary (API, events, schema), so rolling deployments and rollbacks are safe (REL-ZD-03) |
| Operability | What the application itself provides so it can be run: health and readiness, metrics, validated configuration, graceful shutdown, deploy-time migrations, data retention ([scope](../03-context-and-scope/README.md#scope)) |
| Outbox / inbox | Outbox: events are written in the same transaction as the business data and published afterwards. Inbox: processed message ids are stored to drop duplicates (MSG-PUB, MSG-IDM) |
| Personal data | Any information relating to an identified or identifiable person (GDPR Art. 4(1)); includes ids that can be linked back to a person |
| Port | Interface at the boundary of the core: incoming (use-case interfaces) or outgoing (what the core needs from outside) |
| Pseudonymisation / anonymisation | Pseudonymised data can be linked back to a person with extra information and stays personal data; anonymised data cannot and is not personal data |
| Record of processing activities | Art. 30 GDPR list of processing activities; each product keeps its part in `docs/data-protection/processing-record.md` (DP-INV-01) |
| Ring | One layer of the hexagonal architecture: domain, ports, application, adapters |
| Roll forward | Fixing a faulty release with a new release instead of reverting to the previous one; the default (REL-RB-01) |
| Route handler | A Next.js `route.ts` file answering HTTP requests; an incoming adapter, used for the BFF endpoints, the API proxy and the probes, not for business APIs ([05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md)) |
| Rule ID | Stable identifier of a rule (`PREFIX-AREA-NN`), cited in reviews, commits and ADRs |
| Runtime config | Per-environment frontend configuration loaded at startup from the serving origin (`/config.json`), not built in (CFG-11, NG-CFG, REACT-CFG); a Next.js app passes a public subset from the server instead (NEXT-CFG-05) |
| SAST / DAST / SCA | Static and dynamic application security testing; software composition analysis (dependency scanning) ([secure-pipeline.md](../08-crosscutting-concepts/security/secure-pipeline.md)) |
| SBOM | Software bill of materials (CycloneDX), published with releases (SEC-CI-03) |
| Server action | A Next.js function marked `'use server'` that the browser calls over HTTP; a public endpoint and an incoming adapter that calls one use case ([security/nextjs.md](../08-crosscutting-concepts/security/nextjs.md)) |
| Server component | A React component that renders only on the server (Next.js App Router default); an incoming UI adapter that gets use cases from the request-scoped server composition ([05-building-block-view/nextjs.md](../05-building-block-view/nextjs.md)) |
| Shared kernel | Value objects shared by two bounded contexts; allowed only with an ADR (ARCH-ORG-09) |
| Skill | Packaged agent instructions (`SKILL.md`); third-party skills supply know-how, own skills point at these docs (D11) |
| Skill override | A documented conflict between a skill and these docs, resolved in favour of the docs |
| SLI / SLO | Service level indicator (a measured ratio such as successful requests) and objective (its target over a window), defined per user journey (OBS-16) |
| Slice | A Redux Toolkit unit of state, reducers and actions; in React frontends the view state of a feature's UI adapter, injected lazily into the one app store ([ui/react-state-management.md](../08-crosscutting-concepts/ui/react-state-management.md)) |
| Slice test | (Spring) test that starts only one layer of the context (`@WebMvcTest`, `@DataJpaTest`) |
| Stereotype | Our component annotations (`@UseCase`, `@WebAdapter`, `@PersistenceAdapter`, `@MessagingAdapter`, `@SchedulingAdapter`, `@MetricsAdapter`, `@HttpClientAdapter`, `@MailAdapter`, `@FileAdapter`) (SPRING-ARCH-04) |
| Timeout | Upper bound on how long an outbound call may take; mandatory for every remote call (RES-TMO-01) |
| Trace context | W3C `traceparent` header carrying trace and span id across hops; the trace id is the correlation id (OBS-10/11) |
| Trunk-based development | Short-lived branches merged into `main` frequently; `main` is always releasable (REL-BR-01) |
| Use case | One business operation, implemented in the application ring behind an incoming port |
| View state | UI-only state of a screen, held in the UI adapter: a Signal Store in Angular (NG-STATE), a Redux Toolkit slice in React (REACT-STATE) |
