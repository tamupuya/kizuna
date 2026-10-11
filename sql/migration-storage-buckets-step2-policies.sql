-- ============================================================
-- Kizuna Storage · Step 2/2 —— 只建策略（必须先在 Step 1 建好桶）
-- 2026-10-07
-- ============================================================
--
-- 【前置】Step 1 已执行成功（storage.buckets 里有 kizuna-avatars /
--   zhonggu-images / oc-artworks 三行）。
--
-- 【本段只做一件事】给 storage.objects 建读写策略。
--   本事务只接触 storage.objects 一张表，不会与 Step 1 交叉持锁。
--   全部幂等（DROP POLICY IF EXISTS + CREATE POLICY），重复执行无害。
--
-- 【安全说明】P0 阶段：放开读写（与现有数据表策略一致）。
--   应用身份是自建 users.id（UUID），非 auth.uid()，故策略条件用 bucket_id 判定。
--   风险：任何人可往这三个桶写文件；日后收紧建议改用 signed upload URL 或
--   服务端 RPC 校验（标 P1）。公开读是刻意的（图片需公网可访问）。
-- ============================================================

SET lock_timeout = '15s';

-- ------------------------------------------------------------
-- kizuna-avatars（头像）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS kizuna_avatars_select ON storage.objects;
CREATE POLICY kizuna_avatars_select ON storage.objects
  FOR SELECT USING (bucket_id = 'kizuna-avatars');

DROP POLICY IF EXISTS kizuna_avatars_insert ON storage.objects;
CREATE POLICY kizuna_avatars_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'kizuna-avatars');

DROP POLICY IF EXISTS kizuna_avatars_update ON storage.objects;
CREATE POLICY kizuna_avatars_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'kizuna-avatars');

DROP POLICY IF EXISTS kizuna_avatars_delete ON storage.objects;
CREATE POLICY kizuna_avatars_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'kizuna-avatars');

-- ------------------------------------------------------------
-- zhonggu-images（中谷店商品图 + 收款码）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS zhonggu_images_select ON storage.objects;
CREATE POLICY zhonggu_images_select ON storage.objects
  FOR SELECT USING (bucket_id = 'zhonggu-images');

DROP POLICY IF EXISTS zhonggu_images_insert ON storage.objects;
CREATE POLICY zhonggu_images_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'zhonggu-images');

DROP POLICY IF EXISTS zhonggu_images_update ON storage.objects;
CREATE POLICY zhonggu_images_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'zhonggu-images');

DROP POLICY IF EXISTS zhonggu_images_delete ON storage.objects;
CREATE POLICY zhonggu_images_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'zhonggu-images');

-- ------------------------------------------------------------
-- oc-artworks（OC 作品图）
-- ------------------------------------------------------------
DROP POLICY IF EXISTS oc_artworks_select ON storage.objects;
CREATE POLICY oc_artworks_select ON storage.objects
  FOR SELECT USING (bucket_id = 'oc-artworks');

DROP POLICY IF EXISTS oc_artworks_insert ON storage.objects;
CREATE POLICY oc_artworks_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'oc-artworks');

DROP POLICY IF EXISTS oc_artworks_update ON storage.objects;
CREATE POLICY oc_artworks_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'oc-artworks');

DROP POLICY IF EXISTS oc_artworks_delete ON storage.objects;
CREATE POLICY oc_artworks_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'oc-artworks');

-- 验证：应看到 12 行策略
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname IN (
    'kizuna_avatars_select','kizuna_avatars_insert','kizuna_avatars_update','kizuna_avatars_delete',
    'zhonggu_images_select','zhonggu_images_insert','zhonggu_images_update','zhonggu_images_delete',
    'oc_artworks_select','oc_artworks_insert','oc_artworks_update','oc_artworks_delete'
  )
ORDER BY policyname;
