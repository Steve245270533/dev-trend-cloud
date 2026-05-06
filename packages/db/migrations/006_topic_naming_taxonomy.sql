CREATE TABLE IF NOT EXISTS topic_label_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_cluster_id UUID NOT NULL,
  cluster_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('llm-generated', 'fallback-generated')
  ),
  label TEXT NOT NULL,
  summary TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  taxonomy_l1 TEXT NOT NULL,
  taxonomy_l2 TEXT,
  taxonomy_l3 TEXT,
  fallback_reason TEXT CHECK (
    fallback_reason IN (
      'provider-error',
      'provider-timeout',
      'missing-config',
      'invalid-response',
      'low-quality'
    )
  ),
  provider TEXT,
  model TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_cluster_id, cluster_version),
  FOREIGN KEY (topic_cluster_id, cluster_version)
    REFERENCES topic_clusters (topic_cluster_id, cluster_version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_label_candidates_status_updated
  ON topic_label_candidates (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS topic_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('l1', 'l2', 'l3')),
  parent_topic_id UUID REFERENCES topic_nodes (id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('llm', 'fallback')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_nodes_level_parent
  ON topic_nodes (level, parent_topic_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS topic_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_cluster_id UUID NOT NULL,
  cluster_version TEXT NOT NULL,
  label_candidate_id UUID NOT NULL REFERENCES topic_label_candidates (id) ON DELETE CASCADE,
  l1_topic_id UUID NOT NULL REFERENCES topic_nodes (id) ON DELETE RESTRICT,
  l2_topic_id UUID REFERENCES topic_nodes (id) ON DELETE RESTRICT,
  l3_topic_id UUID REFERENCES topic_nodes (id) ON DELETE RESTRICT,
  path_slugs TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_cluster_id, cluster_version),
  FOREIGN KEY (topic_cluster_id, cluster_version)
    REFERENCES topic_clusters (topic_cluster_id, cluster_version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_lineage_l1
  ON topic_lineage (l1_topic_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS topic_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_cluster_id UUID NOT NULL,
  cluster_version TEXT NOT NULL,
  topic_node_id UUID NOT NULL REFERENCES topic_nodes (id) ON DELETE CASCADE,
  membership_role TEXT NOT NULL CHECK (membership_role IN ('primary', 'supporting')),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_cluster_id, cluster_version, topic_node_id),
  FOREIGN KEY (topic_cluster_id, cluster_version)
    REFERENCES topic_clusters (topic_cluster_id, cluster_version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_topic_memberships_topic
  ON topic_memberships (topic_node_id, updated_at DESC);
