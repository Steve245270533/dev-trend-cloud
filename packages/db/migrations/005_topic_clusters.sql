CREATE TABLE IF NOT EXISTS topic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_cluster_id UUID NOT NULL,
  stable_key TEXT NOT NULL,
  cluster_version TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  anchor_canonical_id TEXT NOT NULL REFERENCES unified_contents (canonical_id) ON DELETE CASCADE,
  representative_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_mix JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_repos TEXT[] NOT NULL DEFAULT '{}',
  related_entities TEXT[] NOT NULL DEFAULT '{}',
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  cluster_confidence DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (
    cluster_confidence >= 0 AND cluster_confidence <= 1
  ),
  runtime_fallback_reason TEXT CHECK (
    runtime_fallback_reason IN (
      'missing-cluster',
      'low-confidence',
      'embedding-missing',
      'candidate-conflict',
      'insufficient-keywords',
      'worker-error'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  UNIQUE (topic_cluster_id, cluster_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_topic_clusters_active_id
  ON topic_clusters (topic_cluster_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_topic_clusters_rule_status_updated_at
  ON topic_clusters (rule_version, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_clusters_runtime_priority
  ON topic_clusters (status, runtime_fallback_reason, cluster_confidence DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_clusters_anchor
  ON topic_clusters (anchor_canonical_id);

CREATE TABLE IF NOT EXISTS topic_cluster_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_cluster_row_id UUID NOT NULL REFERENCES topic_clusters (id) ON DELETE CASCADE,
  topic_cluster_id UUID NOT NULL,
  cluster_version TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES unified_contents (canonical_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  embedding_record_id UUID REFERENCES embedding_records (id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  membership_confidence DOUBLE PRECISION NOT NULL CHECK (
    membership_confidence >= 0 AND membership_confidence <= 1
  ),
  primary_evidence BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_rank INTEGER NOT NULL DEFAULT 1 CHECK (evidence_rank >= 1),
  reasoning_tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_cluster_id, canonical_id, cluster_version)
);

CREATE INDEX IF NOT EXISTS idx_topic_cluster_memberships_cluster_rank
  ON topic_cluster_memberships (topic_cluster_row_id, evidence_rank ASC);

CREATE INDEX IF NOT EXISTS idx_topic_cluster_memberships_canonical
  ON topic_cluster_memberships (canonical_id, created_at DESC);
