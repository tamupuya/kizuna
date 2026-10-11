-- Kizuna MBTI 独立字段 migration
-- 2026-08-26
-- 问题：MBTI 曾以 'mbti:INTJ' 前缀混存于 intent_want 数组，导致数据模型混乱、
--       雷达意图匹配读到脏数据。
-- 修复：新增 users.mbti 独立列，前端读写改用独立字段（向后兼容旧数据）。

-- 独立执行本段即可
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mbti VARCHAR(4);

-- 可选：为旧数据做一次性迁移（把 intent_want 里的 'mbti:XXXX' 提取到 mbti 列）
-- 注意：仅当确认无并发写入时执行；intent_want 里的 mbti 前缀项可由前端下次保存时自动清理
-- UPDATE users
--   SET mbti = (regexp_matches(array_to_string(intent_want, ','), 'mbti:([A-Z]{4})'))[1]
--   WHERE intent_want IS NOT NULL
--     AND array_to_string(intent_want, ',') ~ 'mbti:[A-Z]{4}';
