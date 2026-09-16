CREATE TABLE IF NOT EXISTS company_sessions (
  session_id text PRIMARY KEY,
  state_json jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_runs (
  session_id text NOT NULL REFERENCES company_sessions(session_id) ON DELETE CASCADE,
  run_id text NOT NULL,
  day integer NOT NULL CHECK (day BETWEEN 1 AND 5),
  scenario text NOT NULL,
  before_json jsonb NOT NULL,
  result_json jsonb NOT NULL,
  after_hash text NOT NULL CHECK (char_length(after_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, run_id),
  UNIQUE (session_id, day)
);

CREATE INDEX IF NOT EXISTS idx_day_runs_session_created
  ON day_runs(session_id, created_at DESC);
