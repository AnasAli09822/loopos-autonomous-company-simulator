export function nextId(s, prefix) {
  s.counters[prefix] += 1;
  return `${prefix}_${String(s.counters[prefix]).padStart(4, '0')}`;
}
export function addAction(s, runId, role, action_type, status, record_type = '', record_id = '', detail = {}) {
  s.actions.push({ run_id: runId, day: s.day, role, action_type, record_type, record_id, status, detail });
}
export function addEvent(s, runId, actor, event_type, record_type = '', record_id = '', payload = {}) {
  s.events.push({ run_id: runId, day: s.day, actor, event_type, record_type, record_id, payload });
}
