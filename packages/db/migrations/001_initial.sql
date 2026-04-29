DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension is unavailable in the current Postgres instance; continuing without vector.';
END
$$;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS source_runs (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  error_text TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  records_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS raw_snapshots (
  id UUID PRIMARY KEY,
  source_run_id UUID REFERENCES source_runs (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  command TEXT NOT NULL,
  snapshot_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  storage_uri TEXT,
  collected_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY,
  canonical_key TEXT NOT NULL,
  source TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  answer_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  content_type TEXT NOT NULL,
  is_question BOOLEAN NOT NULL DEFAULT FALSE,
  raw_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_item_id)
);

CREATE TABLE IF NOT EXISTS item_sources (
  id UUID PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  command TEXT NOT NULL,
  source_run_id UUID REFERENCES source_runs (id) ON DELETE SET NULL,
  snapshot_id UUID REFERENCES raw_snapshots (id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  collected_at TIMESTAMPTZ NOT NULL,
  UNIQUE (source, source_item_id)
);

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  repo_patterns TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  repos TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_topics (
  item_id UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  confidence DOUBLE PRECISION NOT NULL,
  matched_keywords TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (item_id, topic_id)
);

CREATE TABLE IF NOT EXISTS item_entities (
  item_id UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
  confidence DOUBLE PRECISION NOT NULL,
  matched_keywords TEXT[] NOT NULL DEFAULT '{}',
  repo_name TEXT,
  PRIMARY KEY (item_id, entity_id)
);

CREATE TABLE IF NOT EXISTS question_clusters (
  id UUID PRIMARY KEY,
  cluster_key TEXT NOT NULL UNIQUE,
  canonical_question TEXT NOT NULL,
  growth_label TEXT NOT NULL,
  novelty_label TEXT NOT NULL,
  affected_topics TEXT[] NOT NULL DEFAULT '{}',
  affected_entities TEXT[] NOT NULL DEFAULT '{}',
  related_repos TEXT[] NOT NULL DEFAULT '{}',
  source_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  freshness_minutes INTEGER NOT NULL DEFAULT 0,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  recommended_action TEXT NOT NULL,
  duplicate_compression_ratio DOUBLE PRECISION NOT NULL DEFAULT 1,
  source_diversity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_cluster_items (
  cluster_id UUID NOT NULL REFERENCES question_clusters (id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  similarity DOUBLE PRECISION NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, item_id)
);

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY,
  signal_type TEXT NOT NULL,
  cluster_id UUID REFERENCES question_clusters (id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities (id) ON DELETE SET NULL,
  repo_name TEXT,
  canonical_question TEXT NOT NULL,
  pressure_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  unresolved_volume INTEGER NOT NULL DEFAULT 0,
  growth_label TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  freshness_minutes INTEGER NOT NULL DEFAULT 0,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signal_evidence (
  id UUID PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES signals (id) ON DELETE CASCADE,
  item_id UUID REFERENCES items (id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  source TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rules JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_events (
  id UUID PRIMARY KEY,
  watchlist_id UUID NOT NULL REFERENCES watchlists (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_health (
  source TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_text TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  last_latency_ms INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_items_published_at ON items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_is_question ON items (is_question);
CREATE INDEX IF NOT EXISTS idx_question_clusters_updated_at ON question_clusters (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_cluster_id ON signals (cluster_id);
