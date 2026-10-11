-- ============================================================
-- Kizuna Storage · Step 1/2 —— 只建桶
-- 2026-10-07 · 修复头像/商品图/OC 图上传失败
-- ============================================================
--
-- 【为什么要拆成两步】
--   上一版把「建桶」和「建策略」放在同一个事务里，会同时对
--   storage.buckets（Insert 取 AccessExclusiveLock）和
--   storage.objects（DROP/CREATE POLICY 取 AccessExclusiveLock）加锁，
--   若与其它会话交叉持锁即触发 deadlock（40P01）→ 整个事务回滚。
--   拆开后每个事务只碰一张表，不会再交叉。
--
-- 【如何执行】
--   整段粘贴到 Supabase SQL Editor → Run。
--   成功后再单独执行 Step 2（策略部分）。
--   全部幂等，重复执行无害。
--
-- 【本段只做一件事】创建三个公开桶（public=true 表示图片可公网访问）
-- ============================================================

SET lock_timeout = '15s';

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('kizuna-avatars', 'kizuna-avatars', true),
  ('zhonggu-images', 'zhonggu-images', true),
  ('oc-artworks',    'oc-artworks',    true)
ON CONFLICT (id) DO NOTHING;

-- 验证：应看到 3 行
SELECT id, name, public FROM storage.buckets ORDER BY id;
