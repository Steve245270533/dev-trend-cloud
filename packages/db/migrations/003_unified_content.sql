CREATE TABLE IF NOT EXISTS unified_contents (
  canonical_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_excerpt TEXT,
  url TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  timestamp_origin TEXT NOT NULL CHECK (timestamp_origin IN ('source', 'collected')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  fingerprint TEXT NOT NULL,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  legacy_item_id UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  legacy_item_source_id UUID REFERENCES item_sources (id) ON DELETE SET NULL,
  raw_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_item_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_contents_source_published_at
  ON unified_contents (source, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_contents_legacy_item_id
  ON unified_contents (legacy_item_id);
