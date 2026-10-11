-- ============================================================
-- Kizuna Storage 存储桶建桶 + 策略
-- 2026-10-07 · 修复头像/商品图/OC 图上传失败
-- ============================================================
--
-- 【⚠️ 已废弃 · 不要直接跑本文件】
--   本文件把「建桶」与「建策略」放在同一事务，会同时锁 storage.buckets
--   与 storage.objects，与其它会话交叉持锁时触发 deadlock (40P01) →
--   整个事务回滚（实测已发生）。
--   请改用拆分后的两份：
--     sql/migration-storage-buckets-step1-create.sql     （只建桶）
--     sql/migration-storage-buckets-step2-policies.sql   （只建策略）
--   先跑 Step 1 成功，再跑 Step 2。
--
-- 【本次诊断结论】（直连 Supabase 实测）
--   GET /storage/v1/bucket 返回 []（空）
--   POST /storage/v1/object/kizuna-avatars/... 返回
--     {"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}
--   → 三个存储桶 kizuna-avatars / zhonggu-images / oc-artworks 从未创建
--   → 头像上传、商品图上传、OC 图上传全部静默失败（图库能开、选图后上传报错）
--
-- 【如何执行】整段粘贴到 Supabase SQL Editor，一次性 Run 即可。
--   全部幂等（ON CONFLICT / DROP POLICY IF EXISTS），重复执行无害。
--
-- 【安全说明】P0 阶段：public=true + 放开读写（与现有数据表策略一致）。
--   应用身份是自建 users.id（UUID），非 auth.uid()，故策略用 true。
--   风险：任何人可往桶里写文件；日后收紧建议改用 signed upload URL 或
--   服务端 RPC 校验（标 P1）。公开读是刻意的（图片需公网可访问）。
-- ============================================================


-- ============================================================
-- 第 1 段：建桶（公开读）
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('kizuna-avatars', 'kizuna-avatars', true),
  ('zhonggu-images', 'zhonggu-images', true),
  ('oc-artworks',    'oc-artworks',    true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ============================================================
-- 第 2 段：kizuna-avatars 策略（头像）
-- ============================================================
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


-- ============================================================
-- 第 3 段：zhonggu-images 策略（中谷店商品图 + 收款码）
-- ============================================================
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


-- ============================================================
-- 第 4 段：oc-artworks 策略（OC 作品图）
-- ============================================================
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


-- ============================================================
-- 验证（可选）：列出所有桶
-- ============================================================
-- SELECT id, name, public FROM storage.buckets ORDER BY id;
