import { neon } from '@neondatabase/serverless';
import { initialState } from './engine/state.js';

let _sql;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  _sql ||= neon(process.env.DATABASE_URL);
  return _sql;
}

export async function ensureSession(sessionId) {
  const sql = db();
  await sql`INSERT INTO company_sessions(session_id,state_json) VALUES(${sessionId}, ${JSON.stringify(initialState())}::jsonb) ON CONFLICT (session_id) DO NOTHING`;
  const rows = await sql`SELECT state_json,version FROM company_sessions WHERE session_id=${sessionId}`;
  if (!rows.length) throw new Error('session initialization failed');
  return { state: rows[0].state_json, version: Number(rows[0].version) };
}

export async function listRuns(sessionId) {
  const sql = db();
  return sql`SELECT run_id,day,scenario,after_hash,created_at FROM day_runs WHERE session_id=${sessionId} ORDER BY day DESC,created_at DESC LIMIT 12`;
}

export async function loadSessionWithRuns(sessionId) {
  const [session, runs] = await Promise.all([ensureSession(sessionId), listRuns(sessionId)]);
  return { ...session, runs };
}

export async function commitDay({ sessionId, expectedVersion, state, run }) {
  const sql = db();
  const rows = await sql`
    WITH updated AS (
      UPDATE company_sessions
      SET state_json=${JSON.stringify(state)}::jsonb, version=version+1, updated_at=now()
      WHERE session_id=${sessionId} AND version=${expectedVersion}
      RETURNING version
    ), inserted AS (
      INSERT INTO day_runs(session_id,run_id,day,scenario,before_json,result_json,after_hash)
      SELECT ${sessionId}, ${run.run_id}, ${run.day}, ${run.scenario}, ${JSON.stringify(run.before)}::jsonb, ${JSON.stringify(run.publicResult)}::jsonb, ${run.state_hash}
      FROM updated
      RETURNING run_id
    )
    SELECT (SELECT version FROM updated) AS version, (SELECT run_id FROM inserted) AS run_id
  `;
  if (!rows.length || rows[0].version == null) return null;
  return Number(rows[0].version);
}

export async function commitState({ sessionId, expectedVersion, state }) {
  const sql = db();
  const rows = await sql`
    UPDATE company_sessions
    SET state_json=${JSON.stringify(state)}::jsonb, version=version+1, updated_at=now()
    WHERE session_id=${sessionId} AND version=${expectedVersion}
    RETURNING version
  `;
  return rows.length ? Number(rows[0].version) : null;
}

export async function resetSession(sessionId) {
  const sql = db();
  const state = initialState();
  const rows = await sql`
    WITH deleted AS (
      DELETE FROM day_runs WHERE session_id=${sessionId}
    ), upserted AS (
      INSERT INTO company_sessions(session_id,state_json,version,updated_at)
      VALUES(${sessionId}, ${JSON.stringify(state)}::jsonb, 0, now())
      ON CONFLICT (session_id) DO UPDATE
      SET state_json=EXCLUDED.state_json, version=company_sessions.version+1, updated_at=now()
      RETURNING version
    )
    SELECT version FROM upserted
  `;
  return { state, version: Number(rows[0].version) };
}

export async function getRun(sessionId, runId) {
  const sql = db();
  const rows = await sql`SELECT run_id,day,scenario,before_json,result_json,after_hash,created_at FROM day_runs WHERE session_id=${sessionId} AND run_id=${runId}`;
  return rows[0] || null;
}
