-- ============================================================
-- migration-radar-room-rls.sql
-- 修复：同窗会发消息失败（红色感叹号 / 无法发送）
-- 日期：2026-10-04
-- ============================================================
--
-- 【根因】
-- radar_rooms / radar_room_messages 两张表启用了行级安全（RLS），
-- 但【没有】允许应用写入的策略。
-- 表现：网络正常、Supabase 可达、表存在，但 INSERT 返回
--   42501 "new row violates row-level security policy for table \"radar_room_messages\""
-- 前端把 insert 报错 → 标为 failed → 红色感叹号。
--
-- 【为什么不是代码问题】
-- v0.10 已修复「status 列不存在」的旧缺陷（剥离本地瞬时状态），
-- 但剥离后 INSERT 走到 RLS 检查，暴露了更深一层的「缺策略」问题。
--
-- 【身份模型说明】
-- 本应用当前的身份是「自建 users.id」（UUID，如 93b7755a-...），
-- 而非 Supabase Auth 的 auth.uid()。现有 users 表数据中 auth_uid 全为 null。
-- 因此 RLS 策略【不能】用 auth.uid() 作为写入条件，否则匿名/选身份场景仍会失败。
--
-- 【P0 方案】依赖「房间 id 凭证 + 密码门 + 60s 删除」做保护，
-- 与 users 表现有的宽松写入策略（可 INSERT）一致，不新增风险面。
-- 日后若要收紧，正确路径是：把应用身份统一到 auth.uid()，再改策略。
-- ============================================================


-- ---------- 第 1 段：radar_rooms 读写策略 ----------
ALTER TABLE radar_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_rooms_select_all ON radar_rooms;
CREATE POLICY radar_rooms_select_all
  ON radar_rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS radar_rooms_insert_all ON radar_rooms;
CREATE POLICY radar_rooms_insert_all
  ON radar_rooms FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS radar_rooms_update_all ON radar_rooms;
CREATE POLICY radar_rooms_update_all
  ON radar_rooms FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS radar_rooms_delete_all ON radar_rooms;
CREATE POLICY radar_rooms_delete_all
  ON radar_rooms FOR DELETE
  USING (true);


-- ---------- 第 2 段：radar_room_messages 读写策略 ----------
ALTER TABLE radar_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_room_messages_select_all ON radar_room_messages;
CREATE POLICY radar_room_messages_select_all
  ON radar_room_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS radar_room_messages_insert_all ON radar_room_messages;
CREATE POLICY radar_room_messages_insert_all
  ON radar_room_messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS radar_room_messages_update_all ON radar_room_messages;
CREATE POLICY radar_room_messages_update_all
  ON radar_room_messages FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS radar_room_messages_delete_all ON radar_room_messages;
CREATE POLICY radar_room_messages_delete_all
  ON radar_room_messages FOR DELETE
  USING (true);
