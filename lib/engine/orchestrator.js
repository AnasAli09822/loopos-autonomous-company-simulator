import { randomUUID } from 'node:crypto';
import { SCENARIO_LEADS, WEEK_PLAN, injectScenario } from './scenarios.js';
import { clone, hashState, kpis } from './state.js';
import { authorize } from './authority.js';
import { addAction, addEvent } from './audit.js';
import { runSales } from './agents/sales.js';
import { monitorOps, executeOps, recoverOps } from './agents/ops.js';
import { controlFinance, settleFinance } from './agents/finance.js';

export class HumanDecisionPending extends Error {}
export class WeekComplete extends Error {}

export async function runDay(state, scenario, runId = `run_${randomUUID().replaceAll('-', '').slice(0, 12)}`) {
  if (!(scenario in SCENARIO_LEADS)) throw new Error(`unknown scenario: ${scenario}`);
  const openHuman = state.inbox.filter((i) => i.status === 'open').length;
  if (openHuman) throw new HumanDecisionPending(`${openHuman} human decision(s) must be resolved before another day can run`);
  if (state.day >= 5) throw new WeekComplete('The five-day simulation is complete. Reset the company to run another week.');
  const before = clone(state), beforeK = kpis(state);
  state.day += 1; state.flex_capacity = 0;
  injectScenario(state, runId, scenario);
  const sales = runSales(state, runId, scenario);
  const monitor = monitorOps(state, runId);
  const control = controlFinance(state, runId);
  const execute = executeOps(state, runId);
  const settle = settleFinance(state, runId);
  const recover = recoverOps(state, runId);
  const afterK = kpis(state), state_hash = await hashState(state);
  const numeric = ['cash', 'revenue', 'cost', 'backlog', 'churn_risk', 'churned_customers', 'pipeline', 'open_human_items'];
  const kpi_delta = Object.fromEntries(numeric.map((key) => [key, +(afterK[key] - beforeK[key]).toFixed(4)]));
  return { run_id: runId, day: state.day, scenario, state, before, kpis_before: beforeK, kpis_after: afterK, kpi_delta, agents: { sales, ops: { monitor, execute, recover }, finance: { control, settle } }, self_corrected: recover.self_corrected, human_required: afterK.open_human_items > 0, state_hash, events: state.events.filter((e) => e.run_id === runId), actions: state.actions.filter((a) => a.run_id === runId) };
}

export function resolveHuman(state, id, decision, note = '') {
  authorize('human', 'resolve_inbox');
  const item = state.inbox.find((x) => x.id === id && x.status === 'open');
  if (!item) throw new Error('Open inbox item not found');
  if (!['approve', 'reject', 'acknowledge'].includes(decision)) throw new Error('invalid human decision');
  if (item.kind === 'discount_approval' && decision === 'acknowledge') throw new Error('discount approval requires approve or reject');
  item.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'acknowledged'; item.resolved_day = state.day; item.resolution_note = note;
  if (item.kind === 'discount_approval') {
    const lead = state.leads.find((x) => x.id === item.record_id);
    if (decision === 'approve') { lead.discount_approved = true; lead.status = 'open'; }
    else if (decision === 'reject') lead.status = 'lost';
  }
  if (item.kind === 'control_breach' && ['approve', 'acknowledge'].includes(decision)) state.sales_suspended = false;
  const runId = `human_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
  addAction(state, runId, 'human', 'resolve_inbox', 'applied', 'human_inbox', id, { decision, note });
  addEvent(state, runId, 'human', 'human_decision_recorded', 'human_inbox', id, { decision, note });
  return runId;
}

export function view(state, runs = []) {
  return { company: state.company, kpis: kpis(state), controls: { sales_throttled: state.throttle_sales, sales_suspended: state.sales_suspended, capacity: state.base_capacity + state.flex_capacity, base_capacity: state.base_capacity, flex_capacity: state.flex_capacity, cash_reserve_floor: state.reserve_floor }, records: { leads: [...state.leads].reverse().slice(0, 20), orders: [...state.orders].reverse().slice(0, 20), invoices: [...state.invoices].reverse().slice(0, 20), budgets: [...state.budgets].reverse().slice(0, 20) }, human_inbox: state.inbox.filter((i) => i.status === 'open'), recent_actions: [...state.actions].reverse().slice(0, 18), recent_events: [...state.events].reverse().slice(0, 30), runs };
}

export { WEEK_PLAN };
