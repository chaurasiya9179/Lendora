# Lendora FinTech Platform — REST API Specification

All endpoints communicate using JSON payloads and standard HTTP response codes.
Authentication uses Bearer Tokens (`Authorization: Bearer <JWT>`).

---

## 1. Authentication
- `POST /api/auth/login`: Authenticate staff user and receive JWT.
  ```json
  { "email": "admin@lendora.com", "password": "Admin@123" }
  ```
- `GET /api/auth/me`: Retrieve current active user profile and permissions.
- `POST /api/auth/register`: Create new staff user (Admin only).

---

## 2. Customer CRM
- `GET /api/customers`: List customers with search, KYC status filters, and pagination.
- `GET /api/customers/:id`: 360-degree customer profile with active loans, total borrowed, total paid, documents, and notes.
- `POST /api/customers`: Register new customer with KYC and financial info.
- `PUT /api/customers/:id`: Update customer CRM details.
- `POST /api/customers/:id/notes`: Log customer activity, call record, or reminder note.
- `POST /api/customers/:id/documents`: Upload customer KYC document.

---

## 3. Loans & Amortization
- `POST /api/loans/preview-calculation`: Calculate live amortization preview before issuing loan.
- `GET /api/loans`: List loan accounts with search and status filters (`ACTIVE`, `OVERDUE`, `CLOSED`, etc.).
- `GET /api/loans/:id`: Full loan account details, active schedule items, and payment history.
- `POST /api/loans`: Create loan, generate schedule version 1, and disburse funds.
- `GET /api/loans/:id/prepayment-quote`: Calculate early foreclosure settlement quote.
- `POST /api/loans/:id/foreclose`: Execute full loan settlement and close loan account.
- `POST /api/loans/:id/restructure`: Restructure remaining principal with new rate/tenure (creates schedule version 2).

---

## 4. Payments & Receipts
- `GET /api/payments`: Master payment transaction register.
- `GET /api/payments/:id`: Payment transaction detail and line-item allocations.
- `GET /api/payments/:id/receipt`: Official printable payment receipt data.
- `POST /api/payments`: Post payment with automated waterfall allocation (`Penalty -> Fees -> Interest -> Principal`).
- `POST /api/payments/:id/reverse`: Issue audit-logged payment reversal transaction (Admin only).

---

## 5. Overdue & Penalties
- `GET /api/overdue/aging-summary`: 5-tier delinquency breakdown (1-7, 8-30, 31-60, 61-90, 90+ days).
- `POST /api/overdue/calculate-penalties`: Run automatic late penalty engine on active delinquent accounts.
- `POST /api/overdue/penalties/:id/waive`: Waive penalty charge with reason and audit log.

---

## 6. Collections & Tasks
- `GET /api/collections/tasks`: Agent call queue and follow-up tasks.
- `POST /api/collections/tasks`: Create collection follow-up task.
- `PUT /api/collections/tasks/:id/notes`: Record call outcome, contact result, and Promise-to-Pay (PTP) commitment.
- `GET /api/collections/performance`: Agent recovery metrics, target completion, and collection efficiency %.

---

## 7. Reports & Compliance
- `GET /api/reports/dashboard`: Live portfolio analytics (disbursements, collections, cash flow trends, status distribution).
- `GET /api/reports/export?type=loans|payments|customers`: Download full CSV dataset.
- `GET /api/audit-logs`: Immutable system compliance trail with before/after state diffs (Admin only).

---

## 8. Business Settings
- `GET /api/settings`: Retrieve organization settings, currency, allocation rules, and penalty policies.
- `PUT /api/settings`: Update lender preferences and business rules (Admin only).
