-- =============================================================================
-- LENDORA FINTECH PLATFORM - RELATIONAL DATABASE SCHEMA (PostgreSQL 3NF)
-- All financial amounts use NUMERIC(15, 2) or NUMERIC(18, 4) for exact precision.
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. BUSINESS PROFILES (Lender / Multi-tenant Config)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50) NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(100) DEFAULT 'India',
    currency VARCHAR(10) DEFAULT 'INR',
    currency_symbol VARCHAR(10) DEFAULT '₹',
    currency_precision INTEGER DEFAULT 2 CHECK (currency_precision BETWEEN 0 AND 4),
    date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
    allocation_order VARCHAR(100) DEFAULT 'PENALTY_FEES_INTEREST_PRINCIPAL' 
        CHECK (allocation_order IN (
            'PENALTY_FEES_INTEREST_PRINCIPAL',
            'PRINCIPAL_INTEREST_FEES_PENALTY',
            'INTEREST_PRINCIPAL_FEES_PENALTY',
            'FEES_PENALTY_INTEREST_PRINCIPAL'
        )),
    default_grace_period_days INTEGER DEFAULT 3 CHECK (default_grace_period_days >= 0),
    default_late_penalty_type VARCHAR(50) DEFAULT 'PERCENTAGE' 
        CHECK (default_late_penalty_type IN ('FIXED', 'PERCENTAGE', 'DAILY_PERCENTAGE')),
    default_late_penalty_value NUMERIC(8, 4) DEFAULT 5.0000 CHECK (default_late_penalty_value >= 0),
    prepayment_penalty_rate NUMERIC(8, 4) DEFAULT 0.0000 CHECK (prepayment_penalty_rate >= 0),
    logo_url TEXT,
    receipt_footer_note TEXT DEFAULT 'Thank you for your business. For billing queries, contact our support.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. USERS & ROLES (RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'COLLECTION_AGENT', 'ACCOUNTANT')),
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_business_role ON users(business_id, role);

-- -----------------------------------------------------------------------------
-- 3. CUSTOMERS (CRM)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    date_of_birth DATE,
    id_type VARCHAR(50) DEFAULT 'NATIONAL_ID', -- PASSPORT, SSN, DRIVING_LICENSE, NATIONAL_ID, TAX_ID
    id_number VARCHAR(100),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(100) DEFAULT 'USA',
    occupation VARCHAR(100),
    employer_name VARCHAR(150),
    monthly_income NUMERIC(15, 2) DEFAULT 0.00 CHECK (monthly_income >= 0),
    credit_score INTEGER CHECK (credit_score BETWEEN 300 AND 900),
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relation VARCHAR(50),
    kyc_status VARCHAR(50) DEFAULT 'PENDING' CHECK (kyc_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    customer_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (customer_status IN ('ACTIVE', 'INACTIVE', 'BLACKLISTED')),
    assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_business_status ON customers(business_id, customer_status);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_staff ON customers(assigned_staff_id);

-- -----------------------------------------------------------------------------
-- 4. CUSTOMER DOCUMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- IDENTITY_PROOF, ADDRESS_PROOF, INCOME_PROOF, LOAN_AGREEMENT, COLLATERAL, OTHER
    document_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_docs_customer ON customer_documents(customer_id);

-- -----------------------------------------------------------------------------
-- 5. CUSTOMER NOTES & TIMELINE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note_type VARCHAR(50) DEFAULT 'GENERAL' 
        CHECK (note_type IN ('GENERAL', 'CALL_LOG', 'KYC', 'COLLECTION', 'PAYMENT_REMINDER', 'LOAN_INQUIRY')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);

-- -----------------------------------------------------------------------------
-- 6. LOANS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    loan_account_number VARCHAR(50) UNIQUE NOT NULL,
    loan_type VARCHAR(50) NOT NULL 
        CHECK (loan_type IN ('PERSONAL', 'BUSINESS', 'GOLD_LOAN', 'VEHICLE', 'MICROFINANCE', 'MORTGAGE', 'AUTO', 'EQUIPMENT', 'PAYDAY', 'DASTI_DAILY', 'EDUCATION')),
    principal_amount NUMERIC(15, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate NUMERIC(8, 4) NOT NULL CHECK (interest_rate >= 0),
    interest_rate_period VARCHAR(50) DEFAULT 'ANNUAL' CHECK (interest_rate_period IN ('ANNUAL', 'MONTHLY', 'DAILY')),
    interest_calculation_method VARCHAR(50) NOT NULL 
        CHECK (interest_calculation_method IN ('EMI_REDUCING', 'SIMPLE_INTEREST', 'COMPOUND_INTEREST', 'FLAT_RATE', 'REDUCING_BALANCE', 'INTEREST_ONLY')),
    tenure_value INTEGER NOT NULL CHECK (tenure_value > 0),
    tenure_unit VARCHAR(50) NOT NULL CHECK (tenure_unit IN ('DAYS', 'WEEKS', 'MONTHS', 'YEARS')),
    payment_frequency VARCHAR(50) NOT NULL 
        CHECK (payment_frequency IN ('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'LUMP_SUM')),
    disbursement_date DATE NOT NULL,
    first_payment_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    processing_fee NUMERIC(15, 2) DEFAULT 0.00 CHECK (processing_fee >= 0),
    insurance_fee NUMERIC(15, 2) DEFAULT 0.00 CHECK (insurance_fee >= 0),
    other_charges NUMERIC(15, 2) DEFAULT 0.00 CHECK (other_charges >= 0),
    grace_period_days INTEGER DEFAULT 0 CHECK (grace_period_days >= 0),
    late_penalty_type VARCHAR(50) DEFAULT 'PERCENTAGE' 
        CHECK (late_penalty_type IN ('FIXED', 'PERCENTAGE', 'DAILY_PERCENTAGE')),
    late_penalty_value NUMERIC(8, 4) DEFAULT 0.00 CHECK (late_penalty_value >= 0),
    prepayment_penalty_rate NUMERIC(8, 4) DEFAULT 0.00 CHECK (prepayment_penalty_rate >= 0),
    total_principal_paid NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_principal_paid >= 0),
    total_interest_paid NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_interest_paid >= 0),
    total_penalty_paid NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_penalty_paid >= 0),
    total_fees_paid NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_fees_paid >= 0),
    outstanding_principal NUMERIC(15, 2) NOT NULL CHECK (outstanding_principal >= 0),
    outstanding_interest NUMERIC(15, 2) NOT NULL CHECK (outstanding_interest >= 0),
    outstanding_penalty NUMERIC(15, 2) DEFAULT 0.00 CHECK (outstanding_penalty >= 0),
    outstanding_fees NUMERIC(15, 2) DEFAULT 0.00 CHECK (outstanding_fees >= 0),
    status VARCHAR(50) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'APPROVED', 'DISBURSED', 'ACTIVE', 'OVERDUE', 'RESTRUCTURED', 'CLOSED', 'DEFAULTED', 'REJECTED')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    disbursed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    disbursed_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    closure_reason VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_account_no ON loans(loan_account_number);
CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_business_status ON loans(business_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_maturity_date ON loans(maturity_date);

-- -----------------------------------------------------------------------------
-- 7. LOAN REPAYMENT SCHEDULES (Versioned)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    reason_for_version TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(loan_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_loan_schedules_loan_active ON loan_schedules(loan_id, is_active);

-- -----------------------------------------------------------------------------
-- 8. LOAN SCHEDULE ITEMS (Installment Breakdown)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_schedule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES loan_schedules(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    opening_principal NUMERIC(15, 2) NOT NULL,
    principal_due NUMERIC(15, 2) NOT NULL,
    interest_due NUMERIC(15, 2) NOT NULL,
    fees_due NUMERIC(15, 2) DEFAULT 0.00,
    penalty_due NUMERIC(15, 2) DEFAULT 0.00,
    total_emi_amount NUMERIC(15, 2) NOT NULL,
    closing_principal NUMERIC(15, 2) NOT NULL,
    principal_paid NUMERIC(15, 2) DEFAULT 0.00,
    interest_paid NUMERIC(15, 2) DEFAULT 0.00,
    penalty_paid NUMERIC(15, 2) DEFAULT 0.00,
    fees_paid NUMERIC(15, 2) DEFAULT 0.00,
    total_paid NUMERIC(15, 2) DEFAULT 0.00,
    remaining_balance NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'UPCOMING' 
        CHECK (status IN ('UPCOMING', 'DUE_TODAY', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'WAIVED', 'RESCHEDULED')),
    days_overdue INTEGER DEFAULT 0 CHECK (days_overdue >= 0),
    paid_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(schedule_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule ON loan_schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_due_status ON loan_schedule_items(due_date, status);

-- -----------------------------------------------------------------------------
-- 9. PAYMENTS (Immutable Financial Receipts & Ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    payment_date DATE NOT NULL,
    payment_amount NUMERIC(15, 2) NOT NULL CHECK (payment_amount > 0),
    payment_method VARCHAR(50) NOT NULL 
        CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'ONLINE', 'ADJUSTMENT')),
    transaction_reference VARCHAR(100),
    principal_component NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    interest_component NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    penalty_component NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    fees_component NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    excess_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_reversal BOOLEAN DEFAULT FALSE,
    reversed_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    collected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- -----------------------------------------------------------------------------
-- 10. PAYMENT ALLOCATIONS (Schedule Item Mapping)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    schedule_item_id UUID REFERENCES loan_schedule_items(id) ON DELETE CASCADE,
    principal_allocated NUMERIC(15, 2) DEFAULT 0.00,
    interest_allocated NUMERIC(15, 2) DEFAULT 0.00,
    penalty_allocated NUMERIC(15, 2) DEFAULT 0.00,
    fees_allocated NUMERIC(15, 2) DEFAULT 0.00,
    total_allocated NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_schedule_item ON payment_allocations(schedule_item_id);

-- -----------------------------------------------------------------------------
-- 11. PENALTIES & LATE FEE LOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    schedule_item_id UUID REFERENCES loan_schedule_items(id) ON DELETE CASCADE,
    penalty_amount NUMERIC(15, 2) NOT NULL CHECK (penalty_amount > 0),
    penalty_reason VARCHAR(255) NOT NULL,
    calculation_details JSONB,
    is_waived BOOLEAN DEFAULT FALSE,
    waived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waived_reason TEXT,
    waived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penalties_loan ON penalties(loan_id);
CREATE INDEX IF NOT EXISTS idx_penalties_schedule_item ON penalties(schedule_item_id);

-- -----------------------------------------------------------------------------
-- 12. COLLECTION TASKS & AGENT WORKFLOW
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    schedule_item_id UUID REFERENCES loan_schedule_items(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(50) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(50) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'CONTACTED', 'PROMISE_TO_PAY', 'RESOLVED', 'DEFAULTED')),
    promise_to_pay_date DATE,
    promise_amount NUMERIC(15, 2),
    contact_result VARCHAR(100), -- REACHED, UNREACHABLE, WRONG_NUMBER, REFUSED_TO_PAY, PROMISED
    notes TEXT,
    due_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_tasks_agent_status ON collection_tasks(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_collection_tasks_due ON collection_tasks(due_date);

-- -----------------------------------------------------------------------------
-- 13. AUDIT LOGS (Immutable Compliance Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL, -- e.g., CUSTOMER_CREATED, LOAN_CREATED, PAYMENT_RECORDED, LOAN_RESTRUCTURED
    entity VARCHAR(100) NOT NULL, -- CUSTOMER, LOAN, PAYMENT, SCHEDULE, SETTINGS, USER
    entity_id VARCHAR(100) NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_action ON audit_logs(business_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- -----------------------------------------------------------------------------
-- 14. NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('CUSTOMER', 'USER')),
    recipient_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'READ')),
    sent_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id, status);

-- -----------------------------------------------------------------------------
-- 15. DEFAULT SEED DATA (Indian Organization & Staff Users)
-- -----------------------------------------------------------------------------
INSERT INTO business_profiles (
    id, business_name, registration_number, tax_id, contact_email, contact_phone,
    address_line1, city, state, postal_code, country, currency, currency_symbol,
    currency_precision, allocation_order, default_grace_period_days,
    default_late_penalty_type, default_late_penalty_value, prepayment_penalty_rate,
    receipt_footer_note
) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Lendora Finance & Capital Pvt Ltd',
    'CIN-U65999MH2026PTC123456',
    'GSTIN-27AABCL1234F1Z5',
    'support@lendora.in',
    '+91 98765 43210',
    'Level 12, Tower B, Bandra-Kurla Complex (BKC)',
    'Mumbai',
    'Maharashtra',
    '400051',
    'India',
    'INR',
    '₹',
    2,
    'PENALTY_FEES_INTEREST_PRINCIPAL',
    3,
    'PERCENTAGE',
    5.0000,
    0.0000,
    'Computer generated official receipt under Indian IT Act. Thank you for your prompt payment via UPI / IMPS.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (
    id, business_id, first_name, last_name, email, phone, password_hash, role, status
) VALUES 
(
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Rajesh',
    'Sharma',
    'admin@lendora.com',
    '+91 98765 00001',
    '$2a$10$e8w.b3qMhCjJ8qG1F5eUie3sOq1234567890abcdefghijklmno',
    'ADMIN',
    'ACTIVE'
),
(
    'a0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'Priya',
    'Patel',
    'manager@lendora.com',
    '+91 98765 00002',
    '$2a$10$e8w.b3qMhCjJ8qG1F5eUie3sOq1234567890abcdefghijklmno',
    'MANAGER',
    'ACTIVE'
),
(
    'a0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001',
    'Amit',
    'Verma',
    'agent@lendora.com',
    '+91 98765 00003',
    '$2a$10$e8w.b3qMhCjJ8qG1F5eUie3sOq1234567890abcdefghijklmno',
    'COLLECTION_AGENT',
    'ACTIVE'
),
(
    'a0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000001',
    'Neha',
    'Gupta',
    'accountant@lendora.com',
    '+91 98765 00004',
    '$2a$10$e8w.b3qMhCjJ8qG1F5eUie3sOq1234567890abcdefghijklmno',
    'ACCOUNTANT',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;
