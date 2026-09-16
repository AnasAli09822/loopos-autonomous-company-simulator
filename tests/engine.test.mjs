import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, kpis } from '../lib/engine/state.js';
import { authorize, AuthorizationError } from '../lib/engine/authority.js';
import { runDay, resolveHuman, HumanDecisionPending, WeekComplete } from '../lib/engine/orchestrator.js';

async function day(s, scenario, id=`run_${scenario}`){ return runDay(s, scenario, id); }

test('initial state is financially coherent',()=>{const k=kpis(initialState());assert.equal(k.cash,30000);assert.equal(k.revenue,0);assert.equal(k.cost,0);assert.equal(k.backlog,0);assert.equal(k.churned_customers,0)});
test('sales cannot issue invoice',()=>assert.throws(()=>authorize('sales','issue_invoice'),AuthorizationError));
test('ops cannot approve budget',()=>assert.throws(()=>authorize('ops','decide_budget'),AuthorizationError));
test('finance cannot close lead',()=>assert.throws(()=>authorize('finance','close_lead'),AuthorizationError));
test('human cannot fulfill order',()=>assert.throws(()=>authorize('human','fulfill_order'),AuthorizationError));
test('normal day moves revenue and cash',async()=>{const s=initialState(),r=await day(s,'normal');assert.equal(r.kpis_after.revenue,5140);assert.equal(r.kpis_after.cash,35140);assert.equal(r.kpis_after.backlog,0)});
test('normal day has all three agent roles',async()=>{const r=await day(initialState(),'normal');assert.ok(r.agents.sales);assert.ok(r.agents.ops);assert.ok(r.agents.finance)});
test('demand surge creates inter-role budget dependency',async()=>{const r=await day(initialState(),'demand_surge');assert.equal(r.agents.ops.monitor.budget_request,'budget_0001');assert.deepEqual(r.agents.finance.control.approved_budgets,['budget_0001']);assert.equal(r.agents.ops.execute.activated_flex,2)});
test('demand surge self-corrects without human',async()=>{const r=await day(initialState(),'demand_surge');assert.equal(r.agents.ops.monitor.backlog_before,4);assert.equal(r.agents.ops.recover.backlog_after,0);assert.equal(r.self_corrected,true);assert.equal(r.human_required,false)});
test('demand surge moves cost',async()=>{const r=await day(initialState(),'demand_surge');assert.equal(r.kpis_after.cost,800)});
test('enterprise discount opens human inbox',async()=>{const s=initialState(),r=await day(s,'enterprise_discount');assert.equal(r.human_required,true);assert.equal(r.kpis_after.pipeline,12000);assert.equal(s.inbox[0].kind,'discount_approval')});
test('open human inbox blocks next day',async()=>{const s=initialState();await day(s,'enterprise_discount');await assert.rejects(()=>day(s,'quiet','run_next'),HumanDecisionPending)});
test('invalid acknowledge cannot resolve discount',async()=>{const s=initialState();await day(s,'enterprise_discount');assert.throws(()=>resolveHuman(s,'inbox_0001','acknowledge'),/approve or reject/);assert.equal(s.inbox[0].status,'open')});
test('human approve returns same lead to operating loop',async()=>{const s=initialState();await day(s,'enterprise_discount');resolveHuman(s,'inbox_0001','approve');const r=await day(s,'quiet','run_after_approval');assert.equal(r.agents.sales.closed.length,1);assert.equal(r.kpis_after.revenue,9000);assert.equal(r.kpis_after.pipeline,0)});
test('human reject loses discount lead',async()=>{const s=initialState();await day(s,'enterprise_discount');resolveHuman(s,'inbox_0001','reject');assert.equal(s.leads[0].status,'lost')});
test('sales runaway triggers finance control breach',async()=>{const r=await day(initialState(),'sales_runaway');assert.equal(r.agents.sales.closed.length,7);assert.equal(r.agents.finance.control.control_breach,true);assert.ok(r.agents.finance.control.escalation)});
test('sales runaway suspends sales',async()=>{const s=initialState();await day(s,'sales_runaway');assert.equal(s.sales_suspended,true)});
test('ops compensates sales runaway backlog',async()=>{const r=await day(initialState(),'sales_runaway');assert.equal(r.agents.ops.monitor.backlog_before,7);assert.equal(r.agents.ops.recover.backlog_after,1);assert.equal(r.agents.ops.execute.activated_flex,4)});
test('failure moves actual customer churn',async()=>{const r=await day(initialState(),'sales_runaway');assert.equal(r.kpis_after.churned_customers,1);assert.equal(r.agents.ops.recover.churned.length,1)});
test('failure escalates human review',async()=>{const r=await day(initialState(),'sales_runaway');assert.equal(r.human_required,true);assert.equal(r.kpis_after.open_human_items,1)});
test('control breach acknowledge re-enables sales',async()=>{const s=initialState();await day(s,'sales_runaway');resolveHuman(s,'inbox_0001','acknowledge');assert.equal(s.sales_suspended,false)});
test('day execution is deterministic for same state and run id',async()=>{const a=await day(initialState(),'demand_surge','run_fixed');const b=await day(initialState(),'demand_surge','run_fixed');assert.equal(a.state_hash,b.state_hash);assert.deepEqual(a.state,b.state)});
test('different run id changes auditable state hash',async()=>{const a=await day(initialState(),'normal','run_a');const b=await day(initialState(),'normal','run_b');assert.notEqual(a.state_hash,b.state_hash)});
test('week cannot advance beyond day five',async()=>{const s=initialState();for(const [scenario,id] of [['normal','r1'],['demand_surge','r2'],['enterprise_discount','r3']]){await day(s,scenario,id);if(s.inbox.some(i=>i.status==='open'))resolveHuman(s,'inbox_0001','approve')}await day(s,'quiet','r4');await day(s,'sales_runaway','r5');resolveHuman(s,'inbox_0002','acknowledge');await assert.rejects(()=>day(s,'quiet','r6'),WeekComplete)});
test('five-day flow preserves shared records across roles',async()=>{const s=initialState();await day(s,'normal','r1');await day(s,'demand_surge','r2');await day(s,'enterprise_discount','r3');resolveHuman(s,'inbox_0001','approve');await day(s,'quiet','r4');await day(s,'sales_runaway','r5');assert.equal(s.day,5);assert.ok(s.orders.length>=10);assert.ok(s.invoices.length>=9);assert.ok(s.actions.some(a=>a.role==='sales'));assert.ok(s.actions.some(a=>a.role==='ops'));assert.ok(s.actions.some(a=>a.role==='finance'))});

test('replay execution from saved before-state does not mutate live state',async()=>{const live=initialState();const original=await day(live,'demand_surge','run_replay_source');const frozen=structuredClone(live);const replay=await day(structuredClone(original.before),'demand_surge','run_replay_source');assert.equal(replay.state_hash,original.state_hash);assert.deepEqual(live,frozen)});
test('enterprise approval recognizes revenue but does not auto-collect large invoice',async()=>{const s=initialState();await day(s,'enterprise_discount','rd1');resolveHuman(s,'inbox_0001','approve');const r=await day(s,'quiet','rd2');assert.equal(r.kpis_after.revenue,9000);assert.equal(r.kpis_after.cash,30000);assert.equal(s.invoices[0].status,'issued')});
test('enterprise rejection creates no order or revenue',async()=>{const s=initialState();await day(s,'enterprise_discount','rej1');resolveHuman(s,'inbox_0001','reject');const r=await day(s,'quiet','rej2');assert.equal(r.kpis_after.revenue,0);assert.equal(s.orders.length,0)});
test('week sequence reaches human boundary on day three',async()=>{const s=initialState();await day(s,'normal','w1');await day(s,'demand_surge','w2');const r=await day(s,'enterprise_discount','w3');assert.equal(s.day,3);assert.equal(r.human_required,true);assert.equal(s.inbox.filter(i=>i.status==='open').length,1)});
test('finance-approved flex budget is consumed only by operations',async()=>{const s=initialState();const r=await day(s,'demand_surge','flex1');const b=s.budgets[0];assert.equal(b.status,'consumed');assert.equal(b.requested_by,'ops');assert.equal(r.agents.finance.control.approved_budgets[0],b.id);assert.equal(r.agents.ops.execute.activated_flex,2)});
