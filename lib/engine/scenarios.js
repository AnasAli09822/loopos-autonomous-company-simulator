import { authorize } from './authority.js';
import { nextId, addAction, addEvent } from './audit.js';

export const WEEK_PLAN = Object.freeze({ 1: 'normal', 2: 'demand_surge', 3: 'enterprise_discount', 4: 'quiet', 5: 'sales_runaway' });
export const SCENARIO_LEADS = Object.freeze({
  normal: [['Fjord Analytics', 3200, .82, .05], ['Granite Legal', 2100, .68, 0]],
  demand_surge: [['Helix Media', 2800, .91, .05], ['Ion Mobility', 3300, .88, .08], ['Juniper Retail', 2600, .84, 0], ['Kite Robotics', 3600, .80, .10], ['Lumen Works', 1900, .73, 0], ['Mosaic Bio', 2400, .70, 0]],
  enterprise_discount: [['Nova Enterprise', 12000, .94, .25]],
  sales_runaway: [['Orbit One', 3100, .95, .03], ['Pioneer Grid', 3400, .94, .05], ['Quartz Systems', 2800, .93, .04], ['Ridge Commerce', 3600, .92, .02], ['Solstice Labs', 2900, .91, .01], ['Tangent Health', 3300, .90, .06], ['Umbra Security', 3000, .89, .03]],
  quiet: [],
});

export function injectScenario(s, runId, scenario) {
  for (const [company, value, probability, discount] of SCENARIO_LEADS[scenario]) {
    authorize('system', 'inject_lead');
    const id = nextId(s, 'lead');
    s.leads.push({ id, company, value, probability, requested_discount: discount, discount_approved: false, status: 'open', promised_day: s.day + 1, created_day: s.day });
    addAction(s, runId, 'system', 'inject_lead', 'applied', 'lead', id, { value });
    addEvent(s, runId, 'system', 'lead_arrived', 'lead', id, { company, value, discount });
  }
}
