-- migration-radar-room-expo.sql
-- 2026-10-03 · v0.10 同窗会重构
--
-- 背景：用户定义「同窗会」为「同好聚在同一块屏幕/同一场景」。
--   线下同窗会需要绑定漫展 —— 确认后，同漫展 + 同时段在场的人匹配分值更高。
--   线上房间与纯同好聊天不绑漫展。
--
-- 影响：radar_rooms 新增 expo_id 字段 + 索引。
-- 需在 Supabase SQL Editor 手动执行。未执行时前端仍可运行（expo_id 写入会被忽略，匹配无加分）。

-- ============================================================
-- 第 1 段：radar_rooms 新增 expo_id
-- ============================================================
ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS expo_id UUID REFERENCES expos(id) ON DELETE SET NULL;

-- 仅线下房间会有值；按 expo_id 聚合「这一场有哪些同窗会」时需要索引
CREATE INDEX IF NOT EXISTS idx_radar_rooms_expo_id
  ON radar_rooms(expo_id)
  WHERE expo_id IS NOT NULL;

-- ============================================================
-- 第 2 段：room 读写策略（若 radar_rooms 尚未启用 RLS 则跳过）
-- ============================================================
-- 说明：expo_id 不引入新的隐私面 —— 它只标识房间绑定了哪场漫展，
-- 不暴露用户身份。现有 radar_rooms 的 RLS 策略无需因本字段调整。

-- ============================================================
-- 第 3 段（可选，用于「同漫展 + 同时段」匹配）
-- ============================================================
-- 匹配加分需要读取「全体用户」的 venue_presence 记录，
-- 而 useVenuePresence 默认只加载自己的（loadMyPresences）。
-- 前端已实现 best-effort 的 fetchAllPresences()：
--   读得到 → 同场同日同时段 +30 / 同场同日 +22 / 你也在场 +15
--   读不到（RLS 限制）→ 静默降级为 +0，不影响其他维度
--
-- 若要启用完整加分，需放开 venue_presence 的读权限。
-- ⚠️ 注意：这会让任何登录用户可读「谁在哪场漫展、哪个时段」。
--    若不希望暴露此信息，保持现状即可（匹配会降级但不报错）。
--
-- 放开示例（默认注释掉，请自行判断是否接受该隐私代价）：
--
-- CREATE POLICY venue_presence_select_all
--   ON venue_presence FOR SELECT
--   USING (true);
