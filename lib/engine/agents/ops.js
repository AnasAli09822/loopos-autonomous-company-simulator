import { authorize } from '../authority.js';
import { nextId, addAction, addEvent } from '../audit.js';

export function monitorOps(s, runId) {
  const backlog = s.orders.filter((o) => o.status === 'queued').length;
  let throttled = false, budget_request = null;
  if (backlog > s.base_capacity) {
    authorize('ops', 'set_sales_throttle'); s.throttle_sales = true; throttled = true;
    addAction(s, runId, 'ops', 'set_sales_throttle', 'applied', 'company_state', '1', { enabled: true, reason: `backlog ${backlog} exceeds base capacity ${s.base_capacity}` });
    addEvent(s, runId, 'ops', 'sales_throttle_changed', 'company_state', '1', { enabled: true });
    authorize('ops', 'adjust_churn_risk'); s.churn_risk = +Math.min(1, s.churn_risk + Math.min(.12, (backlog - s.base_capacity) * .02)).toFixed(4);
    addEvent(s, runId, 'ops', 'churn_risk_updated', 'company_state', '1', { value: s.churn_risk });
    const existing = s.budgets.find((b) => b.purpose === 'flex_capacity' && ['pending', 'approved'].includes(b.status));
    if (existing) budget_request = existing.id;
    else {
      authorize('ops', 'request_flex');
      const units = Math.min(4, Math.max(1, backlog - s.base_capacity));
      const id = nextId(s, 'budget'), amount = units * 400;
      s.budgets.push({ id, requested_by: 'ops', purpose: 'flex_capacity', amount, units, status: 'pending', created_day: s.day, decided_day: null, reason: null });
      budget_request = id;
      addAction(s, runId, 'ops', 'request_flex', 'applied', 'budget_request', id, { units, amount });
      addEvent(s, runId, 'ops', 'budget_requested', 'budget_request', id, { units, amount });
    }
  }
  return { backlog_before: backlog, throttled, budget_request };
}

export function executeOps(s, runId) {
  let activated_flex = 0; const fulfilled = [];
  for (const budget of s.budgets.filter((b) => b.purpose === 'flex_capacity' && b.status === 'approved')) {
    authorize('ops', 'activate_flex'); s.flex_capacity += budget.units; activated_flex += budget.units; budget.status = 'consumed';
    addAction(s, runId, 'ops', 'activate_flex', 'applied', 'budget_request', budget.id, { units: budget.units });
    addEvent(s, runId, 'ops', 'flex_capacity_activated', 'company_state', '1', { units: budget.units, budget_id: budget.id });
  }
  const cap = s.base_capacity + s.flex_capacity;
  let used = s.orders.filter((o) => o.fulfilled_day === s.day).length;
  for (const order of s.orders.filter((o) => o.status === 'queued').sort((a, b) => a.promised_day - b.promised_day || a.id.localeCompare(b.id))) {
    if (used >= cap) break;
    authorize('ops', 'fulfill_order'); order.status = 'fulfilled'; order.fulfilled_day = s.day; used += 1; fulfilled.push(order.id);
    addAction(s, runId, 'ops', 'fulfill_order', 'applied', 'order', order.id, { capacity_after: cap - used });
    addEvent(s, runId, 'ops', 'order_fulfilled', 'order', order.id, { amount: order.amount });
  }
  return { activated_flex, fulfilled };
}

export function recoverOps(s, runId) {
  const backlog = s.orders.filter((o) => o.status === 'queued').length;
  const overdue = s.orders.filter((o) => o.status === 'queued' && o.promised_day <= s.day).length;
  let self_corrected = false; const churned = [];
  if (backlog > 0 && s.churn_risk >= .15) {
    authorize('ops', 'record_customer_churn');
    const customer = s.customers.filter((c) => c.status === 'active').sort((a, b) => a.health - b.health || a.id.localeCompare(b.id))[0];
    if (customer) {
      customer.status = 'churned'; customer.last_touch_day = s.day; churned.push(customer.id);
      const detail = { reason: 'service pressure exceeded churn threshold', mrr: customer.mrr, health: customer.health };
      addAction(s, runId, 'ops', 'record_customer_churn', 'applied', 'customer', customer.id, detail);
      addEvent(s, runId, 'ops', 'customer_churned', 'customer', customer.id, detail);
    }
  }
  if (overdue) {
    authorize('ops', 'adjust_churn_risk'); s.churn_risk = +Math.min(1, s.churn_risk + Math.min(.15, overdue * .03)).toFixed(4);
  } else if (backlog <= 1) {
    authorize('ops', 'adjust_churn_risk'); s.churn_risk = +Math.max(.05, s.churn_risk - .03).toFixed(4);
    if (s.throttle_sales) {
      authorize('ops', 'set_sales_throttle'); s.throttle_sales = false; self_corrected = true;
      addAction(s, runId, 'ops', 'set_sales_throttle', 'applied', 'company_state', '1', { enabled: false, reason: 'backlog returned to safe range' });
      addEvent(s, runId, 'ops', 'sales_throttle_changed', 'company_state', '1', { enabled: false });
    }
  }
  addEvent(s, runId, 'ops', 'churn_risk_updated', 'company_state', '1', { value: s.churn_risk });
  return { backlog_after: backlog, overdue, self_corrected, churned };
}
