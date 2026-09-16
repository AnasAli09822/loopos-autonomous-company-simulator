export function initialState() {
  return {
    company: 'Northstar Cloud',
    day: 0,
    cash: 30000,
    revenue: 0,
    cost: 0,
    churn_risk: 0.08,
    throttle_sales: false,
    sales_suspended: false,
    base_capacity: 2,
    flex_capacity: 0,
    reserve_floor: 15000,
    counters: { lead: 0, order: 0, invoice: 0, budget: 0, inbox: 0 },
    customers: [
      ['cust_0001', 'Atlas Labs', 1200, 0.92],
      ['cust_0002', 'BrightWorks', 900, 0.86],
      ['cust_0003', 'Cedar Health', 1600, 0.88],
      ['cust_0004', 'Delta Foods', 700, 0.82],
      ['cust_0005', 'Evergreen AI', 2000, 0.90],
    ].map(([id, name, mrr, health]) => ({ id, name, mrr, health, status: 'active', last_touch_day: 0 })),
    leads: [], orders: [], invoices: [], budgets: [], inbox: [], actions: [], events: [],
  };
}

export function clone(value) { return structuredClone(value); }

export function kpis(s) {
  return {
    day: s.day,
    cash: +s.cash.toFixed(2),
    revenue: +s.revenue.toFixed(2),
    cost: +s.cost.toFixed(2),
    backlog: s.orders.filter((o) => o.status === 'queued').length,
    churn_risk: +s.churn_risk.toFixed(4),
    churned_customers: s.customers.filter((c) => c.status === 'churned').length,
    pipeline: +s.leads.filter((l) => ['open', 'pending_human'].includes(l.status)).reduce((a, l) => a + l.value, 0).toFixed(2),
    open_human_items: s.inbox.filter((i) => i.status === 'open').length,
    sales_throttled: s.throttle_sales,
    sales_suspended: s.sales_suspended,
    base_capacity: s.base_capacity,
    flex_capacity: s.flex_capacity,
  };
}

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}

export async function hashState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(state)));
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
