import { neon } from '@neondatabase/serverless';
import { initialState } from './engine/state.js';

let _sql;
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  _sql ||= neon(process.env.DATABASE_URL);
  return _sql;
}

export async function probeDatabase() {
  const sql = db();
  const rows = await sql`SELECT current_user AS role, 1 AS ok`;
  return { ok: Number(rows[0]?.ok) === 1, role: rows[0]?.role || null };
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

  // Reset is an optimistic write just like a day run. Incrementing version
  // invalidates any in-flight request that read the pre-reset company state.
  // Historical runs are deleted only when this version-checked reset wins.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { version: expectedVersion } = await ensureSession(sessionId);
    const rows = await sql`
      WITH reset AS (
        UPDATE company_sessions
        SET state_json=${JSON.stringify(state)}::jsonb,
            version=version+1,
            updated_at=now()
        WHERE session_id=${sessionId} AND version=${expectedVersion}
        RETURNING version
      ), deleted AS (
        DELETE FROM day_runs
        WHERE session_id=${sessionId}
          AND EXISTS (SELECT 1 FROM reset)
        RETURNING run_id
      )
      SELECT
        (SELECT version FROM reset) AS version,
        (SELECT count(*)::int FROM deleted) AS deleted_runs
    `;

    if (rows.length && rows[0].version != null) {
      return {
        state,
        version: Number(rows[0].version),
        deletedRuns: Number(rows[0].deleted_runs || 0),
      };
    }
  }

  const error = new Error('Concurrent company update prevented reset');
  error.code = 'RESET_CONFLICT';
  throw error;
}

export async function getRun(sessionId, runId) {
  const sql = db();
  const rows = await sql`SELECT run_id,day,scenario,before_json,result_json,after_hash,created_at FROM day_runs WHERE session_id=${sessionId} AND run_id=${runId}`;
  return rows[0] || null;
}
