---
id: obligation-alert-taxonomy-v0
language: uz
domain: obligations-alerts
authority: internal-playbook
---

# Obligation And Alert Taxonomy

Obligation categories:

- Payment: invoice, advance payment, milestone payment, final payment, tax withholding, penalty payment.
- Termination: trial termination, non-renewal notice, cure period, suspension notice.
- Renewal: renewal review, auto-renewal window, extension approval.
- Confidentiality: NDA duties, disclosure restriction, confidentiality penalty.
- Delivery: kickoff, sandbox, UAT, production launch, evidence delivery.
- Reporting: monthly uptime report, quarterly business review, compliance report.
- Compliance: DPA signature, data breach notice, security questionnaire, audit evidence, ISO certificate.
- Other: obligations that do not fit above categories.

Owner role mapping:

- Payment and invoice duties usually belong to Finance.
- Termination, renewal, liability, governing law and review queue usually belong to Legal.
- Security evidence, incident notification, audit logs and technical delivery usually belong to Operations or Legal.
- Strategic approvals and budget caps usually belong to Management.

Alert rules:

- If exact due_date exists, create reminder alert.
- For renewal and termination windows, include 60, 30 or 14 day warning where useful.
- If due date is already past, create overdue alert with high priority review.
- Alert source must identify the clause or page.
- Alert title should be actionable, not generic.
