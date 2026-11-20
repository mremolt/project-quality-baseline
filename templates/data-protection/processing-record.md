# Personal-data inventory and record of processing: <product>

Input for the controller's record of processing activities (Art. 30 GDPR). Kept current by the product team in the same pull request as the change (DP-INV-01, DP-INV-03); adopted into the organisation's record by the DPO. Write `TBD (DPO)` where a legal decision is missing; never guess.

Rules: [data-protection.md](../baseline/08-crosscutting-concepts/data-protection/data-protection.md)

| | |
|---|---|
| Controller | `<organisation, address>` |
| Our role | `<controller / processor for <customer>>` |
| DPO contact | `<name or function, e-mail>` |
| Security measures (Art. 32) | [docs/security/requirements.md](../security/requirements.md) |
| Last reviewed | `<YYYY-MM-DD>` by `<name>` |

## Processing activities

One section per purpose.

### <Activity, e.g. "Customer account management">

| Field | Value |
|---|---|
| Purpose | `<why the data is processed>` |
| Legal basis (Art. 6, Art. 9 if special categories) | `TBD (DPO)` |
| Categories of data subjects | `<customers, employees, …>` |
| Categories of personal data | `<name, e-mail, …>`; special categories (Art. 9): `<none / which>` |
| Fields and where they are stored | `<table.column, topic, bucket, index, cache>` (DP-MIN-01) |
| Recipients (internal and external) | `<roles, systems, processors>` |
| Transfers outside the EU/EEA | `<none / country, basis>` (DP-PROC-02) |
| Retention | see [deletion-concept.md](deletion-concept.md), category `<…>` |
| Data subject rights covered by | `<use cases, e.g. ExportPersonalData, ErasePersonalData>` (DP-DSR-01) |
| DPIA needed? | `<no / yes, link>` (DP-INV-03) |

## Processors and external services (DP-PROC-01)

| Service | Data sent | Purpose | DPA (AVV) status | Location of processing | Transfer basis | Fallback if dropped |
|---|---|---|---|---|---|---|
| `<hosting provider>` | `<…>` | `<…>` | `<signed YYYY-MM-DD / pending>` | `<EU / country>` | `<n/a / adequacy / SCC>` | `<…>` |
