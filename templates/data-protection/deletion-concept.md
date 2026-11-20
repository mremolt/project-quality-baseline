# Deletion concept: <product>

Per data category: where the data lives, how long it is kept, and how it is deleted (DP-INV-02, structure after DIN 66398). Periods and statutory retention are decided by the controller and the DPO; write `TBD (DPO)` where a decision is missing.

Rules: [data-protection.md](../baseline/08-crosscutting-concepts/data-protection/data-protection.md) (DP-RET-*), stack rules in the stack file of that topic.

| | |
|---|---|
| Last reviewed | `<YYYY-MM-DD>` by `<name>` |
| Backup retention | `<e.g. 30 days>`; restores re-apply deletions from `<deletion log>` before serving traffic (DP-RET-05) |
| Telemetry retention | logs `<…>`, traces `<…>`, error reports `<…>` (DP-TEL-03) |

## Data categories

| Category | Storage locations | Retention period | Start event | Statutory retention (blocks erasure) | Deletion mechanism | Tested by |
|---|---|---|---|---|---|---|
| `<customer master data>` | `<table customer, topic crm.customer.v1, search index, cache>` | `<24 months>` | `<last contract end>` | `<HGB/AO: invoices 8/10 years → restricted (DP-RET-03)>` | `<nightly job / TTL / crypto-shredding (with DPO agreement)>` | `<test name>` (DP-TEST-01) |

## Erasure on request (Art. 17)

Use case `<ErasePersonalData>`; each module that stores personal data contributes through its own port (DP-DSR-02). Locations it does not reach directly and how they are covered:

| Location | How erasure reaches it |
|---|---|
| `<Kafka topics>` | `<tombstone / retention expiry>` |
| `<backups>` | `<expire after backup retention; deletion log re-applied on restore>` |
| `<dead-letter topics / tables>` | `<retention period; replayed or discarded entries deleted>` |
| `<inbox deduplication records, stored idempotency results>` | `<TTL (RES-IDM-04); payloads with personal data erased with the person>` |
| `<outbox>` | `<rows deleted after sending>` |
| `<security audit trail>` | `<not erased on request; pseudonymous ids only; own retention period: TBD (DPO)>` (SEC-AUD-02) |
