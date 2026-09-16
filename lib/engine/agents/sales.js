import { authorize } from '../authority.js';
import { nextId, addAction, addEvent } from '../audit.js';

export function runSales(s, runId, scenario) {
  const closed = [], escalated = [], skipped = [];
  if (s.sales_suspended) return { closed, escalated, skipped: ['sales_suspended'], mode: scenario === 'sales_runaway' ? 'sales_runaway' : 'normal' };
  const open = s.leads.filter((l) => l.status === 'open').sort((a, b) => b.probability - a.probability || b.value - a.value);
  const max = scenario === 'sales_runaway' ? 7 : (open.length >= 5 ? 4 : 2);
  for (const lead of open) {
    if (closed.length >= max) break;
    if (lead.requested_discount > .15 && !lead.discount_approved) {
      authorize('sales', 'escalate_discount');
      let inbox = s.inbox.find((i) => i.kind === 'discount_approval' && i.record_id === lead.id && i.status === 'open');
      if (!inbox) {
        const inboxId = nextId(s, 'inbox');
        const payload = { requested_discount: lead.requested_discount, deal_value: lead.value, company: lead.company };
        inbox = { id: inboxId, kind: 'discount_approval', title: `Approve ${Math.round(lead.requested_discount * 100)}% discount for ${lead.company}`, role: 'sales', record_type: 'lead', record_id: lead.id, payload, status: 'open', created_day: s.day, resolved_day: null, resolution_note: null };
        s.inbox.push(inbox); lead.status = 'pending_human';
        addAction(s, runId, 'sales', 'escalate_discount', 'escalated', 'lead', lead.id, payload);
        addEvent(s, runId, 'sales', 'human_escalation_created', 'human_inbox', inboxId, payload);
      }
      escalated.push(inbox.id); continue;
    }
    if (s.throttle_sales) { skipped.push('ops_throttle'); break; }
    if (scenario !== 'sales_runaway' && lead.probability < .65) { skipped.push(lead.id); continue; }
    authorize('sales', 'close_lead');
    const orderId = nextId(s, 'order');
    const amount = +(lead.value * (1 - lead.requested_discount)).toFixed(2);
    lead.status = 'won';
    s.orders.push({ id: orderId, lead_id: lead.id, customer_name: lead.company, amount, promised_day: lead.promised_day, status: 'queued', priority: 1, created_day: s.day, fulfilled_day: null });
    addAction(s, runId, 'sales', 'close_lead', 'applied', 'order', orderId, { lead_id: lead.id, amount });
    addEvent(s, runId, 'sales', 'deal_won', 'order', orderId, { lead_id: lead.id, amount });
    closed.push(orderId);
  }
  return { closed, escalated, skipped, mode: scenario === 'sales_runaway' ? 'sales_runaway' : 'normal' };
}
