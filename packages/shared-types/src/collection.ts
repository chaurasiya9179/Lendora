export type CollectionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type CollectionStatus = 'PENDING' | 'IN_PROGRESS' | 'CONTACTED' | 'PROMISE_TO_PAY' | 'RESOLVED' | 'DEFAULTED';
export type ContactResult = 'REACHED' | 'UNREACHABLE' | 'WRONG_NUMBER' | 'REFUSED_TO_PAY' | 'PROMISED';

export interface CollectionTask {
  id: string;
  businessId: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  loanId: string;
  loanAccountNumber?: string;
  scheduleItemId?: string;
  installmentNumber?: number;
  assignedAgentId?: string;
  assignedAgentName?: string;
  priority: CollectionPriority;
  status: CollectionStatus;
  promiseToPayDate?: string;
  promiseAmount?: string;
  contactResult?: ContactResult;
  notes?: string;
  dueDate: string;
  overdueAmount?: string;
  daysOverdue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionAgentPerformance {
  agentId: string;
  agentName: string;
  assignedTasksCount: number;
  resolvedTasksCount: number;
  targetAmount: string;
  collectedAmount: string;
  efficiencyPercentage: number;
}
