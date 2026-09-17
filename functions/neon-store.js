import { initialState } from '../lib/engine/state.js';

function sqlEndpoint(connectionString) {
  const url = new URL(connectionString);
  return `https://${url.hostname.replace(/^[^.]+\./, 'api.')}/sql`;
}

async function query(text, params = []) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw Object.assign(new Error('DATABASE_URL is not configured'), { code: 'DATABASE_URL_MISSING' });

  const response = await fetch(sqlEndpoint(connectionString), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Neon-Connection-String': connectionString,
    },
    body: JSON.stringify({ query: text, params }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message || `Neon SQL HTTP ${response.status}`);
    error.code = body?.code || `NEON_SQL_${response.status}`;
    throw error;
  }
  return body?.rows || [];
}

export async function probeDatabase() {
  const rows = await query('SELECT current_user AS role, current_database() AS db, 1 AS ok');
  return { ok: Number(rows[0]?.ok) === 1, role: rows[0]?.role || null, database: rows[0]?.db || null };
}

export async function ensureSession(sessionId) {
  await query(
    'INSERT INTO company_sessions(session_id,state_json) VALUES($1,$2::jsonb) ON CONFLICT (session_id) DO NOTHING',
    [sessionId, JSON.stringify(initialState())],
  );
  const rows = await query('SELECT state_json,version FROM company_sessions WHERE session_id=$1', [sessionId]);
  if (!rows.length) throw new Error('session initialization failed');
  return { state: rows[0].state_json, version: Number(rows[0].version) };
}

export async function listRuns(sessionId) {
  return query(
    'SELECT run_id,day,scenario,after_hash,created_at FROM day_runs WHERE session_id=$1 ORDER BY day DESC,created_at DESC LIMIT 12',
    [sessionId],
  );
}

export async function loadSessionWithRuns(sessionId) {
  const [session, runs] = await Promise.all([ensureSession(sessionId), listRuns(sessionId)]);
  return { ...session, runs };
}

export async function commitDay({ sessionId, expectedVersion, state, run }) {
  const rows = await query(
    `WITH updated AS (
      UPDATE company_sessions
      SET state_json=$3::jsonb, version=version+1, updated_at=now()
      WHERE session_id=$1 AND version=$2
      RETURNING version
    ), inserted AS (
      INSERT INTO day_runs(session_id,run_id,day,scenario,before_json,result_json,after_hash)
      SELECT $1,$4,$5,$6,$7::jsonb,$8::jsonb,$9 FROM updated
      RETURNING run_id
    )
    SELECT (SELECT version FROM updated) AS version, (SELECT run_id FROM inserted) AS run_id`,
    [
      sessionId,
      expectedVersion,
      JSON.stringify(state),
      run.run_id,
      run.day,
      run.scenario,
      JSON.stringify(run.before),
      JSON.stringify(run.publicResult),
      run.state_hash,
    ],
  );
  if (!rows.length || rows[0].version == null) return null;
  return Number(rows[0].version);
}

export async function commitState({ sessionId, expectedVersion, state }) {
  const rows = await query(
    `UPDATE company_sessions
     SET state_json=$3::jsonb, version=version+1, updated_at=now()
     WHERE session_id=$1 AND version=$2
     RETURNING version`,
    [sessionId, expectedVersion, JSON.stringify(state)],
  );
  return rows.length ? Number(rows[0].version) : null;
}

export async function resetSession(sessionId) {
  const state = initialState();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { version: expectedVersion } = await ensureSession(sessionId);
    const rows = await query(
      `WITH reset AS (
        UPDATE company_sessions
        SET state_json=$3::jsonb, version=version+1, updated_at=now()
        WHERE session_id=$1 AND version=$2
        RETURNING version
      ), deleted AS (
        DELETE FROM day_runs
        WHERE session_id=$1 AND EXISTS (SELECT 1 FROM reset)
        RETURNING run_id
      )
      SELECT (SELECT version FROM reset) AS version,
             (SELECT count(*)::int FROM deleted) AS deleted_runs`,
      [sessionId, expectedVersion, JSON.stringify(state)],
    );
    if (rows.length && rows[0].version != null) {
      return { state, version: Number(rows[0].version), deletedRuns: Number(rows[0].deleted_runs || 0) };
    }
  }
  const error = new Error('Concurrent company update prevented reset');
  error.code = 'RESET_CONFLICT';
  throw error;
}

export async function getRun(sessionId, runId) {
  const rows = await query(
    'SELECT run_id,day,scenario,before_json,result_json,after_hash,created_at FROM day_runs WHERE session_id=$1 AND run_id=$2',
    [sessionId, runId],
  );
  return rows[0] || null;
}
