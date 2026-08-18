export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_CREATED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_KYC_VERIFIED'
  | 'LOAN_CREATED'
  | 'LOAN_APPROVED'
  | 'LOAN_DISBURSED'
  | 'LOAN_RESTRUCTURED'
  | 'LOAN_FORECLOSED'
  | 'LOAN_PRINCIPAL_ADJUSTED'
  | 'LOAN_EMI_STATUS_TOGGLED'
  | 'INSTALLMENT_STATUS_UPDATED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_REVERSED'
  | 'PENALTY_APPLIED'
  | 'PENALTY_WAIVED'
  | 'COLLECTION_NOTE_ADDED'
  | 'SETTINGS_UPDATED';

export type AuditEntity =
  | 'USER'
  | 'CUSTOMER'
  | 'LOAN'
  | 'LOAN_SCHEDULE'
  | 'SCHEDULE_ITEM'
  | 'PAYMENT'
  | 'PENALTY'
  | 'COLLECTION_TASK'
  | 'SETTINGS';

export interface AuditLogEntry {
  id: string;
  businessId: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  previousValue?: Record<string, any> | any;
  newValue?: Record<string, any> | any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
