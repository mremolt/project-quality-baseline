# Retired rule IDs

Rules removed from the baseline because they were deprecated or only repeated another rule. Their IDs are never reused. A product doc, ADR or review that cites one of them reads the replacement instead. Agents do not need this file.

| ID | Removed because | Use instead |
|---|---|---|
| ARCH-ADP-11 | Repeated ARCH-UC-11 (adapters never own the transaction) | ARCH-UC-11 |
| JAVA-TOOL-22 | Deprecated; covered by JAVA-TOOL-05 | JAVA-TOOL-05 |
| REPO-CI-06 | Repeated SEC-CI-01 (one security job in the single pipeline) | SEC-CI-01 |
| REPO-TOOL-01 | Repeated TOOL-IDE-07 (the IDE opens the repository root) | TOOL-IDE-07 |
| SEC-CI-05 | Repeated SEC-REV-02 (checks are never weakened) | SEC-REV-02 |
| SPRING-ARCH-15 | Repeated TEST-ARCH-04 (no in-memory database in tests) | TEST-ARCH-04 |
| SPRING-ARCH-16 | Repeated API-N1-05 and SPRING-TEST-06 (bounded queries, statement counts asserted) | API-N1-05, SPRING-TEST-06 |
| SPRING-ARCH-17 | Only pointed to the Spring OpenAPI and REST docs | SPRING-API-*, SPRING-REST-* |
| SPRING-DB-20 | Contradicted API-REST-15: reads that generate reference data write on a safe method, from unbounded input, and starve the pool with a second transaction | API-REST-15, ARCH-ADP-14 |
| SPRING-MSG-10 | Deprecated; covered by SPRING-RES-09 | SPRING-RES-09 |
| SPRING-REL-05 | Repeated SPRING-OBS-04, OBS-04 and REL-RUN-06 (shutdown budget, termination grace period) | SPRING-OBS-04, REL-RUN-06 |
