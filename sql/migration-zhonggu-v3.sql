-- Kizuna v0.9.21 中谷店详情页 + 关注系统 migration
-- 2026-08-21
-- 4 段：每段独立可执行

-- ============================================
-- 第 1 段：zhonggu_listings 加字段
-- ============================================
ALTER TABLE zhonggu_listings
  ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT '良好'
    CHECK (condition IN ('几乎全新', '全新', '良好', '一般')),
  ADD COLUMN IF NOT EXISTS wants_count INTEGER NOT NULL DEFAULT 0
    CHECK (wants_count >= 0),
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0
    CHECK (views_count >= 0),
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- tags 字段索引（GIN）
CREATE INDEX IF NOT EXISTS idx_zhonggu_listings_tags
  ON zhonggu_listings USING GIN (tags);

-- ============================================
-- 第 2 段：users 加 last_active_at
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- 第 3 段：follows 表（关注系统）
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);

-- ============================================
-- 第 4 段：follows RLS
-- ============================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follows_select_public ON follows;
CREATE POLICY follows_select_public ON follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS follows_insert_self ON follows;
CREATE POLICY follows_insert_self ON follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS follows_delete_self ON follows;
CREATE POLICY follows_delete_self ON follows
  FOR DELETE USING (follower_id = auth.uid());