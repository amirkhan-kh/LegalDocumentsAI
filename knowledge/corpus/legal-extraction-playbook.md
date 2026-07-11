---
id: legal-extraction-playbook-v0
language: uz
domain: contract-analysis
authority: internal-playbook
---

# LegalAI Extraction Playbook

Har bir yuridik PDF tahlilida quyidagi obyektlar alohida ajratiladi:

- Document classification: contract, addendum, invoice, notice, policy yoki non-contract.
- Contract type: services agreement, supply, lease, NDA, employment, finance, addendum.
- Parties: legal name, address, tax identifier, authorized signatory, role.
- Financial terms: total value, hard cap, currency, VAT/tax, invoice condition, payment schedule, penalty, service credit.
- Timeline terms: effective date, end date, renewal date, termination notice date, delivery milestone, acceptance period.
- Obligations: actor, action, deadline, recurrence, owner role, source page, confidence.
- Risks: conflict, ambiguity, missing critical term, unilateral right, unlimited liability, high penalty, data transfer, non-compete.
- Review queue: low confidence extraction, conflicting values, high risk clause, overdue obligation, missing critical term.
- Alerts: payment due, termination window, renewal notice, report deadline, security/compliance deadline.

Yuqori sifat qoidalari:

- Source page bo'lmasa item confidence pasaytiriladi va review_queue ga tushiriladi.
- Qaytarilgan JSON qat'iy schema bo'yicha bo'lishi kerak.
- Model aniq topmagan qiymatni uydirmaydi; bo'sh qiymat va review sababini qaytaradi.
- Uzbek, Russian va English matnlar bitta hujjatda aralash kelishi mumkin; asosiy til va ustuvor til bandi alohida field bo'lishi kerak.
- Conflicting values ham field, ham risk, ham review_queue da ko'rinishi kerak.

Review queue reason qoidasi:

- Reason generic bo'lmasligi kerak.
- Reason ichida clause number, source trigger va aniq conflict/ambiguity bo'lishi kerak.
- Yaxshi: "Clause 6.2 service credit conflict: 5 percent vs 15 percent".
- Yaxshi: "Clause 9.2 OCR ambiguous date 2O26-09-l5".
- Yaxshi: "Clause 10.1 auto-renewal 60-day notice before 2027-07-31".
- Yaxshi: "Clause 11.1 ISO 27001 certificate overdue since 2026-07-01".
- Yomon: "High risk item", "Overdue compliance item", "Needs legal review".
