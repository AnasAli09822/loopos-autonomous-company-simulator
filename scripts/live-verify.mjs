import assert from 'node:assert/strict';

const base = (process.env.LIVE_BASE_URL || 'https://loopos-autonomous-company-simulator-nathmagency-2935s-projects.vercel.app').replace(/\/$/, '');
const session = `ci_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const secondSession = `${session}_b`;

async function request(path, { method = 'GET', body, sid = session, expect = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-loopos-session': sid,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'follow',
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  assert.equal(response.status, expect, `${method} ${path} expected ${expect}, got ${response.status}: ${text.slice(0, 500)}`);
  return data;
}

function pass(name) { console.log(`PASS ${name}`); }

const page = await fetch(base, { redirect: 'follow' });
assert.equal(page.status, 200, `Homepage status ${page.status}`);
assert.match(page.headers.get('content-type') || '', /text\/html/i);
pass('public homepage reachable');

const health = await request('/api/health');
assert.equal(health.status, 'ok');
assert.equal(health.storage, 'neon-postgres');
assert.equal(health.platform, 'vercel');
pass('public health endpoint');

await request('/api/reset', { method: 'POST', body: {} });
let surge = await request('/api/run/day', { method: 'POST', body: { scenario: 'demand_surge' } });
assert.equal(surge.self_corrected, true);
assert.equal(surge.human_required, false);
assert.equal(surge.agents.ops.monitor.backlog_before, 4);
assert.equal(surge.agents.ops.recover.backlog_after, 0);
assert.equal(surge.agents.ops.execute.activated_flex, 2);
assert.equal(surge.kpis_after.revenue, 11536);
assert.equal(surge.kpis_after.cost, 800);
pass('demand surge self-corrects');

let state = await request('/api/state');
assert.equal(state.runs.length, 1);
const replay = await request(`/api/replay/${state.runs[0].run_id}`, { method: 'POST', body: {} });
assert.equal(replay.deterministic_match, true);
assert.equal(replay.original_hash, replay.replay_hash);
pass('replay hash matches');

await request('/api/reset', { method: 'POST', body: {} });
const discount = await request('/api/run/day', { method: 'POST', body: { scenario: 'enterprise_discount' } });
assert.equal(discount.human_required, true);
assert.equal(discount.kpis_after.pipeline, 12000);
await request('/api/run/day', { method: 'POST', body: { scenario: 'quiet' }, expect: 409 });
state = await request('/api/state');
assert.equal(state.human_inbox.length, 1);
const inboxId = state.human_inbox[0].id;
await request(`/api/human/${inboxId}`, { method: 'POST', body: { decision: 'acknowledge' }, expect: 409 });
await request(`/api/human/${inboxId}`, { method: 'POST', body: { decision: 'approve' } });
const resumed = await request('/api/run/day', { method: 'POST', body: { scenario: 'quiet' } });
assert.equal(resumed.kpis_after.revenue, 9000);
assert.equal(resumed.kpis_after.pipeline, 0);
pass('human boundary blocks then resumes same deal');

await request('/api/reset', { method: 'POST', body: {} });
const failure = await request('/api/run/day', { method: 'POST', body: { scenario: 'sales_runaway' } });
assert.equal(failure.agents.sales.closed.length, 7);
assert.equal(failure.agents.finance.control.control_breach, true);
assert.equal(failure.kpis_after.sales_suspended, true);
assert.equal(failure.agents.ops.monitor.backlog_before, 7);
assert.equal(failure.agents.ops.recover.backlog_after, 1);
assert.equal(failure.kpis_after.churned_customers, 1);
assert.equal(failure.human_required, true);
pass('sales runaway contained with residual churn');

await request('/api/reset', { method: 'POST', body: {} });
const weekA = await request('/api/run/week', { method: 'POST', body: {} });
assert.equal(weekA.status, 'paused_for_human');
assert.equal(weekA.current_day, 3);
assert.equal(weekA.runs.length, 3);
state = await request('/api/state');
assert.equal(state.human_inbox.length, 1);
await request(`/api/human/${state.human_inbox[0].id}`, { method: 'POST', body: { decision: 'approve' } });
const weekB = await request('/api/run/week', { method: 'POST', body: {} });
assert.equal(weekB.status, 'paused_for_human');
assert.equal(weekB.current_day, 5);
assert.equal(weekB.runs.length, 2);
state = await request('/api/state');
assert.equal(state.kpis.day, 5);
assert.equal(state.kpis.churned_customers, 1);
assert.equal(state.controls.sales_suspended, true);
pass('run-the-week pauses day 3 and resumes to day 5');

const isolated = await request('/api/state', { sid: secondSession });
assert.equal(isolated.kpis.day, 0);
assert.equal(isolated.kpis.revenue, 0);
pass('browser sessions are isolated');

console.log('\nLIVE ACCEPTANCE PASSED');
