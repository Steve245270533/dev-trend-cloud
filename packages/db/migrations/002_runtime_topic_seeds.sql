CREATE TABLE IF NOT EXISTS runtime_topic_seed_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  error_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS runtime_topic_seeds (
  run_id UUID NOT NULL REFERENCES runtime_topic_seed_runs (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  source_priority INTEGER NOT NULL DEFAULT 0,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  collection_id TEXT,
  devto_tags TEXT[] NOT NULL DEFAULT '{}',
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  refreshed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_runtime_topic_seeds_active_expires
  ON runtime_topic_seeds (active, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_topic_seeds_slug
  ON runtime_topic_seeds (slug);
