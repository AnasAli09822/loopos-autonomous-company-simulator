import { authorize } from '../authority.js';
import { nextId, addAction, addEvent } from '../audit.js';

export function controlFinance(s, runId) {
  const approved_budgets = [], rejected_budgets = [];
  for (const budget of s.budgets.filter((b) => b.status === 'pending')) {
    authorize('finance', 'decide_budget');
    const headroom = s.cash - s.reserve_floor;
    const approved = budget.amount <= Math.max(0, headroom * .35) && s.cash - budget.amount >= s.reserve_floor;
    budget.status = approved ? 'approved' : 'rejected'; budget.decided_day = s.day; budget.reason = approved ? 'reserve-safe flex spend' : 'preserve cash reserve';
    if (approved) { s.cash -= budget.amount; s.cost += budget.amount; approved_budgets.push(budget.id); } else rejected_budgets.push(budget.id);
    addAction(s, runId, 'finance', 'decide_budget', 'applied', 'budget_request', budget.id, { approved, reason: budget.reason });
    addEvent(s, runId, 'finance', 'budget_decided', 'budget_request', budget.id, { approved, amount: budget.amount });
  }
  const salesActions = s.actions.filter((a) => a.run_id === runId && a.role === 'sales' && a.action_type === 'close_lead' && a.status === 'applied').length;
  const bookings = s.orders.filter((o) => o.created_day === s.day).reduce((a, o) => a + o.amount, 0);
  const backlog = s.orders.filter((o) => o.status === 'queued').length;
  const breach = salesActions >= 6 || (bookings > 15000 && backlog > s.base_capacity * 2);
  let escalation = null;
  if (breach) {
    authorize('finance', 'set_sales_suspension'); s.sales_suspended = true;
    addAction(s, runId, 'finance', 'set_sales_suspension', 'applied', 'company_state', '1', { enabled: true, reason: 'commercial velocity exceeded control envelope' });
    addEvent(s, runId, 'finance', 'sales_suspension_changed', 'company_state', '1', { enabled: true });
    authorize('finance', 'escalate_control');
    const id = nextId(s, 'inbox'), payload = { sales_actions: salesActions, bookings, backlog };
    s.inbox.push({ id, kind: 'control_breach', title: 'Sales control breach: commitments exceeded operating envelope', role: 'finance', record_type: 'company_state', record_id: '1', payload, status: 'open', created_day: s.day, resolved_day: null, resolution_note: null });
    addAction(s, runId, 'finance', 'escalate_control', 'escalated', 'human_inbox', id, payload);
    addEvent(s, runId, 'finance', 'human_escalation_created', 'human_inbox', id, payload); escalation = id;
  }
  return { approved_budgets, rejected_budgets, control_breach: breach, escalation };
}

export function settleFinance(s, runId) {
  const issued = [], collected = [];
  for (const order of s.orders.filter((o) => o.status === 'fulfilled' && !s.invoices.some((i) => i.order_id === o.id))) {
    authorize('finance', 'issue_invoice');
    const id = nextId(s, 'invoice');
    s.invoices.push({ id, order_id: order.id, amount: order.amount, status: 'issued', issued_day: s.day, paid_day: null }); s.revenue += order.amount; issued.push(id);
    addAction(s, runId, 'finance', 'issue_invoice', 'applied', 'invoice', id, { order_id: order.id, amount: order.amount });
    addEvent(s, runId, 'finance', 'invoice_issued', 'invoice', id, { order_id: order.id, amount: order.amount });
  }
  for (const invoice of s.invoices.filter((i) => i.status === 'issued' && i.amount <= 5000)) {
    authorize('finance', 'collect_invoice'); invoice.status = 'paid'; invoice.paid_day = s.day; s.cash += invoice.amount; collected.push(invoice.id);
    addAction(s, runId, 'finance', 'collect_invoice', 'applied', 'invoice', invoice.id, { amount: invoice.amount });
    addEvent(s, runId, 'finance', 'cash_collected', 'invoice', invoice.id, { amount: invoice.amount });
  }
  return { issued, collected };
}
