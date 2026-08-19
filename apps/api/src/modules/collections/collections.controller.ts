import { Response } from 'express';
import { db } from '../../database/db.js';
import { pgPool, queryPostgres } from '../../database/postgres.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { CreateCollectionTaskInput, UpdateCollectionNoteInput } from '@lendora/validation';
import { CollectionTask, CollectionAgentPerformance } from '@lendora/shared-types';
import Decimal from 'decimal.js';

export class CollectionsController {
  public static async listTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { status, agentId, priority, date } = req.query;

    let tasks: CollectionTask[] = [];

    if (pgPool) {
      try {
        let query = `
          SELECT ct.*, c.first_name, c.last_name, c.phone as customer_phone, l.loan_account_number,
                 u.first_name as agent_first_name, u.last_name as agent_last_name
          FROM collection_tasks ct
          LEFT JOIN customers c ON ct.customer_id = c.id
          LEFT JOIN loans l ON ct.loan_id = l.id
          LEFT JOIN users u ON ct.assigned_agent_id = u.id
          WHERE ct.business_id = $1
        `;
        const params: any[] = [businessId];

        if (req.user!.role === 'COLLECTION_AGENT') {
          params.push(req.user!.id);
          query += ` AND ct.assigned_agent_id = $${params.length}`;
        } else if (agentId && typeof agentId === 'string') {
          params.push(agentId);
          query += ` AND ct.assigned_agent_id = $${params.length}`;
        }

        if (status && typeof status === 'string') {
          params.push(status);
          query += ` AND ct.status = $${params.length}`;
        }

        if (priority && typeof priority === 'string') {
          params.push(priority);
          query += ` AND ct.priority = $${params.length}`;
        }

        if (date && typeof date === 'string') {
          params.push(date);
          query += ` AND ct.due_date = $${params.length}`;
        }

        query += ' ORDER BY ct.due_date ASC';

        const result = await queryPostgres(query, params);
        tasks = result.rows.map((row: any) => ({
          id: row.id,
          businessId: row.business_id,
          customerId: row.customer_id,
          customerName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : row.customer_name || 'N/A',
          customerPhone: row.customer_phone || row.phone,
          loanId: row.loan_id,
          loanAccountNumber: row.loan_account_number,
          scheduleItemId: row.schedule_item_id,
          assignedAgentId: row.assigned_agent_id,
          assignedAgentName: row.agent_first_name ? `${row.agent_first_name} ${row.agent_last_name}` : undefined,
          priority: row.priority,
          status: row.status,
          contactResult: row.contact_result,
          promiseToPayDate: row.promise_to_pay_date ? new Date(row.promise_to_pay_date).toISOString().split('T')[0] : undefined,
          promiseAmount: row.promise_amount ? String(row.promise_amount) : undefined,
          notes: row.notes,
          dueDate: row.due_date ? new Date(row.due_date).toISOString().split('T')[0] : '',
          overdueAmount: String(row.overdue_amount || '0.00'),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
      } catch (err) {
        console.warn('PostgreSQL collection tasks query fallback:', err);
      }
    }

    if (tasks.length === 0 && !pgPool) {
      tasks = Array.from(db.collectionTasks.values())
        .filter(t => t.businessId === businessId)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      if (req.user!.role === 'COLLECTION_AGENT') {
        tasks = tasks.filter(t => t.assignedAgentId === req.user!.id);
      } else if (agentId && typeof agentId === 'string') {
        tasks = tasks.filter(t => t.assignedAgentId === agentId);
      }

      if (status && typeof status === 'string') {
        tasks = tasks.filter(t => t.status === status);
      }

      if (priority && typeof priority === 'string') {
        tasks = tasks.filter(t => t.priority === priority);
      }

      if (date && typeof date === 'string') {
        tasks = tasks.filter(t => t.dueDate === date);
      }
    }

    res.json({
      success: true,
      data: tasks,
    });
  }

  public static async createTask(req: AuthenticatedRequest & { body: CreateCollectionTaskInput }, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const body = req.body;

    const customer = db.customers.get(body.customerId);
    const loan = db.loans.get(body.loanId);

    let assignedAgentName: string | undefined;
    if (body.assignedAgentId) {
      const agent = db.users.get(body.assignedAgentId);
      if (agent) assignedAgentName = `${agent.firstName} ${agent.lastName}`;
    }

    const newTask: CollectionTask = {
      id: `ct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId,
      customerId: body.customerId,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'N/A',
      customerPhone: customer?.phone || 'N/A',
      loanId: body.loanId,
      loanAccountNumber: loan?.loanAccountNumber || 'N/A',
      scheduleItemId: body.scheduleItemId,
      assignedAgentId: body.assignedAgentId || req.user!.id,
      assignedAgentName: assignedAgentName || `${req.user!.firstName} ${req.user!.lastName}`,
      priority: body.priority,
      status: 'PENDING',
      notes: body.notes,
      dueDate: body.dueDate,
      overdueAmount: loan?.outstandingPrincipal || '0.00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.collectionTasks.set(newTask.id, newTask);

    res.status(201).json({
      success: true,
      data: newTask,
    });
  }

  public static async updateTaskNote(req: AuthenticatedRequest & { body: UpdateCollectionNoteInput }, res: Response): Promise<void> {
    const { id } = req.params;
    const body = req.body;
    const task = db.collectionTasks.get(id);

    if (!task || task.businessId !== req.user!.businessId) {
      res.status(404).json({ success: false, error: 'Collection task not found' });
      return;
    }

    task.status = body.status;
    task.contactResult = body.contactResult;
    task.promiseToPayDate = body.promiseToPayDate;
    task.promiseAmount = body.promiseAmount;
    task.notes = body.notes;
    task.updatedAt = new Date().toISOString();

    // Log note in customer CRM timeline
    db.customerNotes.set(`cn-${Date.now()}`, {
      id: `cn-${Date.now()}`,
      customerId: task.customerId,
      authorId: req.user!.id,
      authorName: `${req.user!.firstName} ${req.user!.lastName}`,
      noteType: 'COLLECTION',
      content: `[Collection Update - ${body.status}]: ${body.notes}${body.promiseToPayDate ? ` (PTP Date: ${body.promiseToPayDate}, Amount: $${body.promiseAmount || '0.00'})` : ''}`,
      createdAt: new Date().toISOString(),
    });

    db.logAudit({
      businessId: task.businessId,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'COLLECTION_NOTE_ADDED',
      entity: 'COLLECTION_TASK',
      entityId: task.id,
      newValue: { status: task.status, result: task.contactResult },
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: task,
    });
  }

  public static async getAgentPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const agents = Array.from(db.users.values()).filter(
      u => u.businessId === businessId && (u.role === 'COLLECTION_AGENT' || u.role === 'MANAGER')
    );

    const performanceList: CollectionAgentPerformance[] = agents.map(agent => {
      const assignedTasks = Array.from(db.collectionTasks.values()).filter(
        t => t.assignedAgentId === agent.id
      );
      const resolved = assignedTasks.filter(t => t.status === 'RESOLVED' || t.status === 'PROMISE_TO_PAY');

      // Collected payments
      const paymentsCollected = Array.from(db.payments.values())
        .filter(p => p.collectedBy === agent.id && !p.isReversal)
        .reduce((sum, p) => sum.plus(p.paymentAmount), new Decimal(0));

      const targetAmount = '50000.00';
      const efficiency = assignedTasks.length > 0
        ? Math.round((resolved.length / assignedTasks.length) * 100)
        : 100;

      return {
        agentId: agent.id,
        agentName: `${agent.firstName} ${agent.lastName}`,
        assignedTasksCount: assignedTasks.length,
        resolvedTasksCount: resolved.length,
        targetAmount,
        collectedAmount: paymentsCollected.toFixed(2),
        efficiencyPercentage: efficiency,
      };
    });

    res.json({
      success: true,
      data: performanceList,
    });
  }
}
