import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../../database/db.js';
import { pgPool, queryPostgres } from '../../database/postgres.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { CustomerInput, CustomerNoteInput } from '@lendora/validation';
import { Customer, CustomerNote, CustomerDocument, CustomerSummaryProfile, Loan } from '@lendora/shared-types';
import Decimal from 'decimal.js';

function mapDbCustomer(row: any): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    customerCode: row.customer_code,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email || undefined,
    phone: row.phone,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : undefined,
    idType: row.id_type || 'AADHAAR',
    idNumber: row.id_number || undefined,
    addressLine1: row.address_line1 || undefined,
    addressLine2: row.address_line2 || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    postalCode: row.postal_code || undefined,
    country: row.country || 'India',
    occupation: row.occupation || undefined,
    employerName: row.employer_name || undefined,
    monthlyIncome: row.monthly_income ? String(row.monthly_income) : '0',
    creditScore: row.credit_score || undefined,
    emergencyContactName: row.emergency_contact_name || undefined,
    emergencyContactPhone: row.emergency_contact_phone || undefined,
    emergencyContactRelation: row.emergency_contact_relation || undefined,
    kycStatus: row.kyc_status || 'VERIFIED',
    customerStatus: row.customer_status || 'ACTIVE',
    assignedStaffId: row.assigned_staff_id || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export class CustomersController {
  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { search, kycStatus, status, page = '1', limit = '20' } = req.query;

    let items: Customer[] = [];

    if (pgPool) {
      try {
        let query = 'SELECT * FROM customers WHERE business_id = $1';
        const params: any[] = [businessId];

        if (search && typeof search === 'string') {
          params.push(`%${search.toLowerCase()}%`);
          query += ` AND (LOWER(first_name) LIKE $${params.length} OR LOWER(last_name) LIKE $${params.length} OR phone LIKE $${params.length} OR LOWER(customer_code) LIKE $${params.length})`;
        }

        if (kycStatus && typeof kycStatus === 'string') {
          params.push(kycStatus);
          query += ` AND kyc_status = $${params.length}`;
        }

        if (status && typeof status === 'string') {
          params.push(status);
          query += ` AND customer_status = $${params.length}`;
        }

        query += ' ORDER BY created_at DESC';

        const result = await queryPostgres(query, params);
        items = result.rows.map(mapDbCustomer);

        // Keep in-memory cache in sync
        for (const c of items) {
          db.customers.set(c.id, c);
        }
      } catch (err) {
        console.warn('PostgreSQL customer fetch fallback to in-memory:', err);
        items = Array.from(db.customers.values()).filter(c => c.businessId === businessId);
      }
    } else {
      items = Array.from(db.customers.values()).filter(c => c.businessId === businessId);
      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        items = items.filter(
          c =>
            c.firstName.toLowerCase().includes(q) ||
            c.lastName.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.customerCode.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q))
        );
      }
      if (kycStatus && typeof kycStatus === 'string') {
        items = items.filter(c => c.kycStatus === kycStatus);
      }
      if (status && typeof status === 'string') {
        items = items.filter(c => c.customerStatus === status);
      }
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;
    const total = items.length;
    const start = (pageNum - 1) * limitNum;
    const paginated = items.slice(start, start + limitNum);

    res.json({
      success: true,
      data: paginated,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  }

  public static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    let customer: Customer | undefined;

    if (pgPool) {
      try {
        const result = await queryPostgres('SELECT * FROM customers WHERE id = $1 AND business_id = $2', [id, req.user!.businessId]);
        if (result.rows.length > 0) {
          const mapped = mapDbCustomer(result.rows[0]);
          customer = mapped;
          db.customers.set(mapped.id, mapped);
        }
      } catch (err) {
        console.warn('PostgreSQL customer getById error:', err);
      }
    }

    if (!customer) {
      customer = db.customers.get(id);
    }

    if (!customer || customer.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    let customerLoans: Loan[] = [];
    if (pgPool) {
      try {
        const loansRes = await queryPostgres(`
          SELECT l.*, c.first_name, c.last_name, c.phone as customer_phone, c.customer_code
          FROM loans l
          LEFT JOIN customers c ON l.customer_id = c.id
          WHERE l.customer_id = $1 AND l.business_id = $2
          ORDER BY l.created_at DESC
        `, [id, req.user!.businessId]);
        customerLoans = loansRes.rows.map((row: any) => ({
          id: row.id,
          businessId: row.business_id,
          customerId: row.customer_id,
          customerName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Borrower',
          customerPhone: row.customer_phone || row.phone,
          customerCode: row.customer_code,
          loanAccountNumber: row.loan_account_number,
          loanType: row.loan_type,
          principalAmount: String(row.principal_amount),
          interestRate: String(row.interest_rate),
          interestRatePeriod: row.interest_rate_period || 'ANNUAL',
          interestCalculationMethod: row.interest_calculation_method,
          tenureValue: Number(row.tenure_value),
          tenureUnit: row.tenure_unit || 'MONTHS',
          paymentFrequency: row.payment_frequency,
          disbursementDate: row.disbursement_date ? new Date(row.disbursement_date).toISOString().split('T')[0] : '',
          firstPaymentDate: row.first_payment_date ? new Date(row.first_payment_date).toISOString().split('T')[0] : '',
          maturityDate: row.maturity_date ? new Date(row.maturity_date).toISOString().split('T')[0] : '',
          processingFee: String(row.processing_fee || '0.00'),
          insuranceFee: String(row.insurance_fee || '0.00'),
          otherCharges: String(row.other_charges || '0.00'),
          gracePeriodDays: row.grace_period_days || 0,
          latePenaltyType: row.late_penalty_type || 'PERCENTAGE',
          latePenaltyValue: String(row.late_penalty_value || '0.00'),
          prepaymentPenaltyRate: String(row.prepayment_penalty_rate || '0.00'),
          totalPrincipalPaid: String(row.total_principal_paid || '0.00'),
          totalInterestPaid: String(row.total_interest_paid || '0.00'),
          totalPenaltyPaid: String(row.total_penalty_paid || '0.00'),
          totalFeesPaid: String(row.total_fees_paid || '0.00'),
          outstandingPrincipal: String(row.outstanding_principal),
          outstandingInterest: String(row.outstanding_interest),
          outstandingPenalty: String(row.outstanding_penalty || '0.00'),
          outstandingFees: String(row.outstanding_fees || '0.00'),
          status: row.status,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        } as any));
      } catch (err) {
        console.warn('PostgreSQL customer loans lookup:', err);
      }
    }

    if (customerLoans.length === 0 && !pgPool) {
      customerLoans = Array.from(db.loans.values()).filter(l => l.customerId === id);
    }
    const activeLoans = customerLoans.filter(l => ['ACTIVE', 'DISBURSED', 'OVERDUE'].includes(l.status));

    let totalBorrowed = new Decimal(0);
    let totalPaidPrincipal = new Decimal(0);
    let totalPaidInterest = new Decimal(0);
    let totalOutstandingP = new Decimal(0);
    let totalOutstandingI = new Decimal(0);
    let totalInterestExpected = new Decimal(0);
    let totalOverdue = new Decimal(0);

    for (const loan of customerLoans) {
      totalBorrowed = totalBorrowed.plus(loan.principalAmount || 0);
      totalPaidPrincipal = totalPaidPrincipal.plus(loan.totalPrincipalPaid || 0);
      totalPaidInterest = totalPaidInterest.plus(loan.totalInterestPaid || 0);
      totalOutstandingP = totalOutstandingP.plus(loan.outstandingPrincipal || 0);
      totalOutstandingI = totalOutstandingI.plus(loan.outstandingInterest || 0);
      
      const expectedI = loan.totalInterestExpected 
        ? new Decimal(loan.totalInterestExpected)
        : new Decimal(loan.outstandingInterest || 0).plus(loan.totalInterestPaid || 0);
      totalInterestExpected = totalInterestExpected.plus(expectedI);

      if (loan.status === 'OVERDUE') {
        totalOverdue = totalOverdue.plus(loan.outstandingPrincipal || 0).plus(loan.outstandingPenalty || 0);
      }
    }

    const totalPortfolioAmount = totalBorrowed.plus(totalInterestExpected);
    const totalAmountPaid = totalPaidPrincipal.plus(totalPaidInterest);

    const documents = Array.from(db.customerDocuments.values()).filter(d => d.customerId === id);
    const notesList = Array.from(db.customerNotes.values())
      .filter(n => n.customerId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const profile: CustomerSummaryProfile = {
      ...customer,
      totalLoansCount: customerLoans.length,
      activeLoansCount: activeLoans.length,
      totalBorrowedPrincipal: totalBorrowed.toFixed(2),
      totalPaidPrincipal: totalPaidPrincipal.toFixed(2),
      totalPaidInterest: totalPaidInterest.toFixed(2),
      totalInterestExpected: totalInterestExpected.toFixed(2),
      totalPortfolioAmount: totalPortfolioAmount.toFixed(2),
      totalAmountPaid: totalAmountPaid.toFixed(2),
      totalOutstandingPrincipal: totalOutstandingP.toFixed(2),
      totalOutstandingInterest: totalOutstandingI.toFixed(2),
      totalOverdueAmount: totalOverdue.toFixed(2),
      documents,
      notesList,
    };

    res.json({
      success: true,
      data: profile,
    });
  }

  public static async create(req: AuthenticatedRequest & { body: CustomerInput }, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const body = req.body;

    const count = db.customers.size + 1;
    const customerCode = `CUST-${String(count).padStart(5, '0')}`;

    let assignedStaffName: string | undefined;
    if (body.assignedStaffId) {
      const staff = db.users.get(body.assignedStaffId);
      if (staff) assignedStaffName = `${staff.firstName} ${staff.lastName}`;
    }

    const customerId = crypto.randomUUID();

    const newCustomer: Customer = {
      id: customerId,
      businessId,
      customerCode,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || undefined,
      phone: body.phone,
      dateOfBirth: body.dateOfBirth,
      idType: body.idType || 'AADHAAR',
      idNumber: body.idNumber,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country || 'India',
      occupation: body.occupation,
      employerName: body.employerName,
      monthlyIncome: String(body.monthlyIncome || '0'),
      creditScore: body.creditScore || 750,
      emergencyContactName: body.emergencyContactName,
      emergencyContactPhone: body.emergencyContactPhone,
      emergencyContactRelation: body.emergencyContactRelation,
      kycStatus: body.kycStatus || 'VERIFIED',
      customerStatus: body.customerStatus || 'ACTIVE',
      assignedStaffId: body.assignedStaffId,
      assignedStaffName,
      notes: body.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Direct Insert into PostgreSQL
    if (pgPool) {
      try {
        await queryPostgres(
          `INSERT INTO customers (
            id, business_id, customer_code, first_name, last_name, email, phone,
            date_of_birth, id_type, id_number, address_line1, address_line2, city, state, postal_code,
            country, occupation, employer_name, monthly_income, credit_score,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
            kyc_status, customer_status, assigned_staff_id, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
          )`,
          [
            newCustomer.id,
            newCustomer.businessId,
            newCustomer.customerCode,
            newCustomer.firstName,
            newCustomer.lastName,
            newCustomer.email || null,
            newCustomer.phone,
            newCustomer.dateOfBirth || null,
            newCustomer.idType || 'AADHAAR',
            newCustomer.idNumber || null,
            newCustomer.addressLine1 || null,
            newCustomer.addressLine2 || null,
            newCustomer.city || null,
            newCustomer.state || null,
            newCustomer.postalCode || null,
            newCustomer.country || 'India',
            newCustomer.occupation || null,
            newCustomer.employerName || null,
            newCustomer.monthlyIncome || '0',
            newCustomer.creditScore || null,
            newCustomer.emergencyContactName || null,
            newCustomer.emergencyContactPhone || null,
            newCustomer.emergencyContactRelation || null,
            newCustomer.kycStatus || 'VERIFIED',
            newCustomer.customerStatus || 'ACTIVE',
            newCustomer.assignedStaffId || null,
            newCustomer.notes || null,
            newCustomer.createdAt,
            newCustomer.updatedAt,
          ]
        );
        console.log(`✅ Customer ${newCustomer.customerCode} (${newCustomer.firstName}) successfully saved into PostgreSQL database!`);
      } catch (pgErr: any) {
        console.error('PostgreSQL Customer Insert Warning:', pgErr.message);
      }
    }

    db.customers.set(newCustomer.id, newCustomer);

    db.logAudit({
      businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'CUSTOMER_CREATED',
      entity: 'CUSTOMER',
      entityId: newCustomer.id,
      newValue: { code: customerCode, name: `${newCustomer.firstName} ${newCustomer.lastName}` },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      data: newCustomer,
    });
  }

  public static async update(req: AuthenticatedRequest & { body: Partial<CustomerInput> }, res: Response): Promise<void> {
    const { id } = req.params;
    let customer: Customer | undefined = db.customers.get(id);

    if (pgPool && !customer) {
      try {
        const result = await queryPostgres('SELECT * FROM customers WHERE id = $1 AND business_id = $2', [id, req.user!.businessId]);
        if (result.rows.length > 0) {
          const mapped = mapDbCustomer(result.rows[0]);
          customer = mapped;
          db.customers.set(mapped.id, mapped);
        }
      } catch (err) {
        console.warn('PostgreSQL fetch before update fallback:', err);
      }
    }

    if (!customer || customer.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const previousValue = { ...customer };
    Object.assign(customer, req.body, { updatedAt: new Date().toISOString() });

    // Persist to PostgreSQL if connected
    if (pgPool) {
      try {
        await queryPostgres(
          `UPDATE customers SET
            first_name = $1,
            last_name = $2,
            phone = $3,
            email = $4,
            date_of_birth = $5,
            id_type = $6,
            id_number = $7,
            address_line1 = $8,
            address_line2 = $9,
            city = $10,
            state = $11,
            postal_code = $12,
            country = $13,
            occupation = $14,
            employer_name = $15,
            monthly_income = $16,
            credit_score = $17,
            kyc_status = $18,
            customer_status = $19,
            notes = $20,
            updated_at = $21
          WHERE id = $22 AND business_id = $23`,
          [
            customer.firstName,
            customer.lastName,
            customer.phone,
            customer.email || null,
            customer.dateOfBirth || null,
            customer.idType || 'AADHAAR',
            customer.idNumber || null,
            customer.addressLine1 || null,
            customer.addressLine2 || null,
            customer.city || null,
            customer.state || null,
            customer.postalCode || null,
            customer.country || 'India',
            customer.occupation || null,
            customer.employerName || null,
            customer.monthlyIncome || '0.00',
            customer.creditScore || null,
            customer.kycStatus || 'VERIFIED',
            customer.customerStatus || 'ACTIVE',
            customer.notes || null,
            customer.updatedAt,
            id,
            req.user!.businessId,
          ]
        );
        console.log(`✅ Customer ${customer.customerCode || id} updated in PostgreSQL database!`);
      } catch (err: any) {
        console.warn('PostgreSQL update warning (fallback to in-memory):', err.message);
      }
    }

    db.customers.set(id, customer);

    db.logAudit({
      businessId: req.user!.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'CUSTOMER_UPDATED',
      entity: 'CUSTOMER',
      entityId: id,
      previousValue,
      newValue: customer,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: customer,
    });
  }

  public static async addNote(req: AuthenticatedRequest & { body: CustomerNoteInput }, res: Response): Promise<void> {
    const { id } = req.params;
    const customer = db.customers.get(id);

    if (!customer || customer.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const note: CustomerNote = {
      id: `cn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerId: id,
      authorId: req.user!.id,
      authorName: `${req.user!.firstName} ${req.user!.lastName}`,
      noteType: req.body.noteType,
      content: req.body.content,
      createdAt: new Date().toISOString(),
    };

    db.customerNotes.set(note.id, note);

    res.status(201).json({
      success: true,
      data: note,
    });
  }

  public static async addDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { documentType, documentName, filePath, mimeType, fileSizeBytes } = req.body;
    const customer = db.customers.get(id);

    if (!customer || customer.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const doc: CustomerDocument = {
      id: `cd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      customerId: id,
      documentType: documentType || 'OTHER',
      documentName: documentName || 'Document.pdf',
      filePath: filePath || '/uploads/doc.pdf',
      mimeType: mimeType || 'application/pdf',
      fileSizeBytes: fileSizeBytes || 102400,
      isVerified: false,
      uploadedBy: req.user!.id,
      createdAt: new Date().toISOString(),
    };

    db.customerDocuments.set(doc.id, doc);

    res.status(201).json({
      success: true,
      data: doc,
    });
  }

  public static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const customer = db.customers.get(id);

    if (!customer || customer.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    if (pgPool) {
      try {
        await queryPostgres('DELETE FROM customers WHERE id = $1 AND business_id = $2', [id, req.user!.businessId]);
      } catch (err) {
        console.warn('PostgreSQL delete fallback to in-memory:', err);
      }
    }

    db.customers.delete(id);
    res.json({ success: true, message: 'Customer deleted successfully' });
  }
}
