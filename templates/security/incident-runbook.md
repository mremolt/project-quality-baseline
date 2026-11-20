# Security Incident Runbook

<!-- SEC-INC-02: who decides, how to rotate credentials, the reporting clocks, how to inform customers, post-mortem within 10 working days.
     Keep it short enough to follow under stress. Baseline rules:
     ../baseline/08-crosscutting-concepts/security/vulnerability-management.md -->

## Contacts

| Role | Who | Reachable via |
|---|---|---|
| Incident lead (decides) | <name / role> | <phone, chat channel> |
| Deputy | <name / role> | <…> |
| Operations / hosting | <team> | <…> |
| Data protection officer (advises) | <name> | <…> |
| Controller's decision maker for breach notification | <name / role, or the customer's contact when we are the processor> | <…> |
| CRA reporting (if SEC-REQ-05 says yes) | <name / role> | <ENISA single reporting platform account> |
| Customer communication | <name / role> | <…> |

## 1. Detect and decide

1. Whoever notices writes into <incident channel> and calls the incident lead.
2. The incident lead decides: incident yes/no, severity, who works on it. Write down times and actions from now on.

## 2. Contain

- Leaked secret: **revoke and rotate first**, remove from history second (SEC-INC-01). Rotation per credential:

  | Credential | Where it lives | How to rotate |
  |---|---|---|
  | <database password> | <secret manager path> | <steps or link> |
  | <OIDC client secret> | <…> | <…> |
  | <API key for …> | <…> | <…> |

- Compromised account or component: <how to disable it, block traffic, take the service offline>.

## 3. Inform

Start the clocks at the moment someone becomes aware; write the time down.

| Clock | Applies when | Deadline | Who |
|---|---|---|---|
| GDPR, we are controller | personal data affected | authority without undue delay, where feasible within 72 h, unless no risk (Art. 33(1)); people affected without undue delay if the risk is high (Art. 34); document every breach (Art. 33(5)) | controller decides, DPO advises (DP-INC-01) |
| GDPR, we are processor | personal data of a customer affected | inform the customer without undue delay (Art. 33(2)), as the DPA says: <hours, channel> | <incident lead> |
| CRA (if SEC-REQ-05 says it applies) | actively exploited vulnerability or severe incident in our product | early warning 24 h, notification 72 h, final report 14 days after a fix is available (severe incident: one month after the notification); inform affected users | <name / role> |
| Contract | <customer contracts with own deadlines> | <…> | <…> |

- Customers: <who informs whom, through which channel, template location>.
- Reporter (if the issue came via `SECURITY.md`): acknowledge and keep them updated.

## 4. Recover

<!-- Restore from backup, redeploy a fixed version, re-enable access. Link the deployment and backup procedures. -->

## 5. Post-mortem (within 10 working days)

Blameless write-up: timeline, root cause, what helped, what didn't, actions with owners. Every action gets an issue; a missing test is added (TEST-ARCH-11). Store it in <location>.
