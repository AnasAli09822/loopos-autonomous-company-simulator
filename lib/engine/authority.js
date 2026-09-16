export const ROLE_PERMISSIONS = Object.freeze({
  sales: new Set(['close_lead', 'escalate_discount']),
  ops: new Set(['set_sales_throttle', 'request_flex', 'activate_flex', 'fulfill_order', 'adjust_churn_risk', 'record_customer_churn']),
  finance: new Set(['decide_budget', 'issue_invoice', 'collect_invoice', 'set_sales_suspension', 'escalate_control']),
  human: new Set(['resolve_inbox']),
  system: new Set(['inject_lead']),
});

export class AuthorizationError extends Error {}

export function authorize(role, action) {
  if (!ROLE_PERMISSIONS[role]?.has(action)) {
    throw new AuthorizationError(`${role} is not authorized for ${action}`);
  }
}
