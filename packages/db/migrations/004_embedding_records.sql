CREATE TABLE IF NOT EXISTS embedding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id TEXT NOT NULL REFERENCES unified_contents (canonical_id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  input_schema_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  model_version TEXT NOT NULL,
  dimensions INTEGER NOT NULL CHECK (dimensions > 0),
  embedding_vector VECTOR NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'succeeded', 'failed', 'superseded')
  ),
  error_text TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded_at TIMESTAMPTZ,
  CHECK (vector_dims(embedding_vector) = dimensions)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_embedding_records_active_dedupe
  ON embedding_records (source, content_fingerprint, model, input_schema_version)
  WHERE status <> 'superseded';

CREATE INDEX IF NOT EXISTS idx_embedding_records_canonical_model
  ON embedding_records (canonical_id, model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_records_status_updated_at
  ON embedding_records (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_records_source_created_at
  ON embedding_records (source, created_at DESC);

-- NOTE:
-- ivfflat/hnsw 索引要求 vector 列具备固定维度（例如 vector(768)）。
-- 当前 schema 允许不同 model/dimensions 共存（embedding_vector 为无 typmod 的 VECTOR），
-- 因此这里先不创建 ANN 向量索引，避免 migration 在 db:reset 阶段失败。
-- S3 若收敛为固定维度模型，可升级为固定维度列并补充 ivfflat/hnsw。
