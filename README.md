# Lendora — Enterprise Loan Management & Customer CRM Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-18%2F19-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)

**Lendora** is an enterprise-grade FinTech Loan Management & Customer Relationship Management (CRM) platform designed for private lenders, microfinance institutions, consumer credit companies, and commercial debt managers.

---

## 🌟 Key Highlights & Capabilities

1. **Deterministic Arbitrary-Precision Financial Engine (`@lendora/financial-engine`)**:
   - Zero floating-point drift with `decimal.js`.
   - Supports **Reducing Balance EMI**, **Flat Rate**, **Simple Interest**, **Compound Interest**, and **Standard Reducing Balance**.
   - Guaranteed **$0.00 closing balance** on maturity amortization.
2. **Configurable Payment Allocation Waterfall**:
   - Automatically distributes incoming payments: `Penalty -> Fees -> Interest -> Principal` (or custom configured order).
   - Instant partial payment tracking and excess credit handling.
3. **Immutable Financial Ledger & Official Receipts**:
   - All transactions are permanent and auditable.
   - Payment reversals create compensating ledger entries.
   - Generates official printable & downloadable payment receipts.
4. **Delinquency Management & 5 Aging Buckets**:
   - Automated aging analysis: `1-7 Days`, `8-30 Days`, `31-60 Days`, `61-90 Days`, and `90+ Days`.
   - Daily automated late fee penalty engine with grace period and capping support.
   - Penalty waiver workflows with audit logging.
5. **Collection Agent Command Center**:
   - Daily target tracking, agent recovery performance %, Promise-To-Pay (PTP) commitments, and call logs.
6. **Loan Restructuring & Early Payoff Foreclosure**:
   - Versioned Amortization Schedules (`Schedule Version 1`, `Version 2`).
   - Live early payoff / foreclosure settlement calculator.
7. **Role-Based Access Control (RBAC)**:
   - `Admin`, `Manager`, `Collection Agent`, `Accountant`.
8. **Compliance Audit Trail**:
   - Append-only audit logger capturing actor, action, previous state, new state, IP address, and timestamps.
9. **Real-Data Portfolio Analytics**:
   - Real database metrics — **NO mock data**. Live Recharts cashflow and distribution graphs.

---

## 📁 Repository Monorepo Architecture

```
Lendora/
├── apps/
│   ├── web/                         # React 19 + TypeScript + Vite + Tailwind UI
│   └── api/                         # Node.js + TypeScript REST API Server
├── packages/
│   ├── financial-engine/            # Decoupled calculation engine (decimal.js)
│   ├── shared-types/                # Shared TypeScript models and interfaces
│   └── validation/                  # Zod validation schemas
├── database/
│   ├── schema.sql                   # 3NF PostgreSQL schema & indexes
│   └── migrations/
├── docs/
│   ├── architecture.md              # System design & component diagrams
│   ├── api.md                       # REST API endpoint specs
│   └── financial-rules.md           # Mathematical formulas & proofs
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/lendora.git
cd Lendora

# Install all workspace dependencies
npm install
```

### 2. Run Tests
```bash
# Run unit test suite for the financial calculation engine
npm run test --workspace=@lendora/financial-engine
```

### 3. Start Development Servers
```bash
# Start backend API (Port 5000)
npm run dev:api

# In a separate terminal, start web frontend (Port 3000)
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Authorized Staff Test Credentials

The system initializes with 4 role-based accounts (all sharing password: `Admin@123`):

| Role | Email | Permissions |
|---|---|---|
| **Admin** | `admin@lendora.com` | Full platform control, audit logs, settings, reversals |
| **Manager** | `manager@lendora.com` | Customer CRM, loan creation, restructuring, reports |
| **Collection Agent** | `agent@lendora.com` | Assigned borrowers, call logging, PTP tracking |
| **Accountant** | `accountant@lendora.com` | Payment recording, receipts, financial reports |

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.
