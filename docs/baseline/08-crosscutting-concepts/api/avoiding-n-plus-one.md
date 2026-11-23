# Avoiding N+1 Requests over REST

An N+1 problem over REST: a client loads a list (1 request), then one request per item to load details or related data (N requests). It works in development with five items and collapses in production with five hundred. The same goes for **waterfalls**: requests that run one after another although they don't depend on each other.

There is no single right fix. This doc is the catalogue of strategies and the rules for choosing one. **The developer decides per use case; whoever proposes a feature (human or agent) MUST check for the problem and recommend a strategy.**

## Where N+1 hides

- A list component whose rows (or row components) each load their own details.
- "Resolve the IDs": a response contains `customerId`s, and the client fetches each customer.
- Nested resources loaded per parent (orders → positions → product per position).
- Per-item permission or status checks.
- Sequential `await`s in a loop.
- A backend batch endpoint that loops over the database per ID: the N+1 has only moved.

## Strategy catalogue

| # | Side | Strategy | Fits when | Costs |
|---|---|---|---|---|
| S1 | Backend | **Use-case-shaped query endpoint**: one query service per screen or caller that returns exactly the view it needs (ARCH-UC-03) | The caller is a stable use case (a specific screen, report, export) | One more endpoint per view; backend knows a bit about the consumer |
| S2 | Backend | **Batch endpoint**: `GET /customers?ids=1,2,3` (or `POST /customers/batch-get` for long lists) | Generic lookups needed by many callers | Clients must collect IDs; URL length limits for GET |
| S3 | Backend | **Expansion**: `?include=customer,positions`, optionally sparse fieldsets | Same resource, callers need different depths | More complex endpoint and caching; risk of over-fetching |
| S4 | Frontend | **Request coalescing** (DataLoader pattern): the outgoing adapter collects IDs requested within one tick and sends one batch request (needs S2) | Many independent components each ask for one item | Small latency added; needs a batch endpoint |
| S5 | Frontend | **Cache + in-flight dedupe**: decorator around the port; identical requests share one promise; TTL or ETag revalidation | Data repeats across screens and changes rarely (reference data, users, settings) | Staleness and invalidation rules |
| S6 | Frontend | **Parallelize independent requests** (`Promise.all`) or move the composition to S1 | Waterfalls of calls that don't depend on each other | Doesn't reduce the number of requests |
| S7 | Both | **Bound N**: pagination, virtual scrolling, load details on demand (expand row) | N can't be removed, only limited | UX changes |

## Rules

- **API-N1-01: Every proposal or change that loads data across a REST boundary MUST be checked for N+1 requests and waterfalls.** This applies to backend endpoint design and frontend features alike, and to code reviews.
- **API-N1-02: The proposer recommends one strategy from the catalogue with its tradeoffs; the developer decides per use case.** The decision and the reason go into the pull request or ticket. Use the template below.
- **API-N1-03: Default order of preference:** S1 if the caller is a stable use case; S2 for generic lookups; S3 only for optional depth. On the frontend, S4/S5 when the backend can't change or the data is shared. S7 whenever N is unbounded. This is a starting point, not a rule.
- **API-N1-04: Frontend mitigations (S4, S5) live in the outgoing adapter**, typically as a decorator implementing the same port. Never in components, view-state stores or use cases.
  *Why:* one place to reason about caching and batching; use cases stay unaware of HTTP.
- **API-N1-05: Backend batch and view endpoints MUST NOT reintroduce N+1 in persistence.** Load related data with joins, `IN` queries or entity graphs; assert query counts in persistence tests.
- **API-N1-08: A view that needs data of several aggregates behind different ports is assembled in the use case ring, with one set-based read per port.** The use case (or a package-private assembler next to it, ARCH-UC-18) collects the ids from the first read and asks each other port once with all of them (`IN` query, bounded list); the persistence adapter test asserts the statement bound for a realistic size (e.g. ≤ 6 selects for 12 entries). Joining across aggregates inside one adapter couples the adapters; a port call per item is N+1.
- **API-N1-09: A read loads only the range its result needs.** A figure that depends on the whole history (a running balance since the first day) reads one bounded range query per fact, with the bound documented in code, and has a documented plan for when the history outgrows it (a snapshot per closed period). A new read that needs a short range (one week) never reuses a helper that loads the whole history.
  *Why:* set-based queries do not help when the set is "everything since the start"; the cost then grows with the age of the account, not with the screen.
- **API-N1-06: Assert with tests.**
  - E2E: a request-count budget per main screen (count API requests while the screen loads; fail when exceeded).
  - Adapter tests: one batch call for N requested items (S4), one call for repeated requests (S5).
  - Backend: query-count assertions on view and batch endpoints.
- **API-N1-07: Unbounded lists are not allowed.** Every list endpoint is paged, or has a documented hard upper bound that the query enforces (API-REST-08, [rest-conventions.md](rest-conventions.md)). A bound that exists only in the documentation is not enough.

## Proposal template (for humans and agents)

```text
N+1 check
- Data loaded: <list of X, plus Y per X>
- Risk: <N+1 / waterfall / none>, expected N in production: <…>
- Recommended: <S#> because <…>
- Alternatives considered: <S#: why not>
- Tests: <request-count budget / batch assertion / query count>
```

*Agent checklist in [checklists/shared.md](../../checklists/shared.md) and sources in [sources.md](../../sources.md), section "Avoiding N+1 Requests over REST".*
