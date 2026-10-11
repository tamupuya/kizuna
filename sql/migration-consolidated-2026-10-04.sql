-- ============================================================
-- Kizuna 数据库一键修复 + 补齐
-- 2026-10-04 · 合并迁移（发消息 RLS + 配对 + 漫展绑定 + MBTI + expo_requests）
-- ============================================================
--
-- 【本次诊断结论】（直连 Supabase 实测）
--   1. 发消息失败根因：radar_rooms / radar_room_messages 开了 RLS 但缺写入策略
--      （读通写被拦 42501 → 前端标 failed → 红色感叹号）
--   2. 缺表：pair_signals / pairings / pair_decisions / expo_requests
--   3. 缺列：radar_rooms.participants/expo_id/mode/pairing_id；users.mbti
--   4. 身份模型：应用身份是自建 users.id（UUID），非 Supabase Auth 的 auth.uid()
--
-- 【关于 RLS 策略】P0 阶段全部放开读写（临时方案）：
--   - 应用身份是自建 UUID，用 auth.uid() 会误伤（当前 10 个用户 8 个无 auth_uid）
--   - 隐私保护靠：产品分层(L0/L1/L2) + 房间 id 凭证 + 密码门 + 60s 自动删除
--   - 日后要收紧：先把应用身份统一到 auth.uid()，再把这些策略改成
--     `user_id IN (SELECT id FROM users WHERE auth_uid = auth.uid())`
--
-- 【如何执行】整段粘贴到 Supabase SQL Editor，一次性 Run 即可。
--   全部幂等（IF NOT EXISTS / DROP POLICY IF EXISTS），重复执行无害。
-- ============================================================


-- ============================================================
-- 第 1 段：修复 radar_rooms 的 RLS（本次发消息失败的核心）
-- ============================================================
ALTER TABLE radar_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_rooms_select_all ON radar_rooms;
CREATE POLICY radar_rooms_select_all ON radar_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS radar_rooms_insert_all ON radar_rooms;
CREATE POLICY radar_rooms_insert_all ON radar_rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS radar_rooms_update_all ON radar_rooms;
CREATE POLICY radar_rooms_update_all ON radar_rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS radar_rooms_delete_all ON radar_rooms;
CREATE POLICY radar_rooms_delete_all ON radar_rooms FOR DELETE USING (true);


-- ============================================================
-- 第 2 段：修复 radar_room_messages 的 RLS
-- ============================================================
ALTER TABLE radar_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS radar_room_messages_select_all ON radar_room_messages;
CREATE POLICY radar_room_messages_select_all ON radar_room_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS radar_room_messages_insert_all ON radar_room_messages;
CREATE POLICY radar_room_messages_insert_all ON radar_room_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS radar_room_messages_update_all ON radar_room_messages;
CREATE POLICY radar_room_messages_update_all ON radar_room_messages FOR UPDATE USING (true);

DROP POLICY IF EXISTS radar_room_messages_delete_all ON radar_room_messages;
CREATE POLICY radar_room_messages_delete_all ON radar_room_messages FOR DELETE USING (true);


-- ============================================================
-- 第 3 段：radar_rooms 补列
--   participants：房间内参与者（存用户 id 数组）
--   expo_id：线下房间绑定的漫展
--   mode：'group' 多人聚集 / 'pair' 双人配对后开房
--   pairing_id：本房间由哪次配对开出
-- ============================================================
ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS participants TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS expo_id UUID REFERENCES expos(id) ON DELETE SET NULL;

ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'group'
    CHECK (mode IN ('group', 'pair'));

ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS pairing_id UUID;

CREATE INDEX IF NOT EXISTS idx_radar_rooms_expo_id
  ON radar_rooms(expo_id)
  WHERE expo_id IS NOT NULL;


-- ============================================================
-- 第 4 段：users 补 mbti 列（MBTI 独立字段，告别 intent_want 前缀）
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mbti VARCHAR(4);

-- 可选：把旧数据里 intent_want 的 'mbti:XXXX' 提取到 mbti 列
-- （仅确认无并发写入时执行；前端下次保存会自动清理）
-- UPDATE users
--   SET mbti = (regexp_matches(array_to_string(intent_want, ','), 'mbti:([A-Z]{4})'))[1]
--   WHERE intent_want IS NOT NULL
--     AND array_to_string(intent_want, ',') ~ 'mbti:[A-Z]{4}';


-- ============================================================
-- 第 5 段：信号池 pair_signals（「推窗」= 我准备好了）
-- ============================================================
CREATE TABLE IF NOT EXISTS pair_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_want     TEXT[]      NOT NULL DEFAULT '{}',
  intent_provide  TEXT[]      NOT NULL DEFAULT '{}',
  expo_id         UUID        REFERENCES expos(id) ON DELETE SET NULL,
  time_window     INTEGER     NOT NULL DEFAULT 900,
  expires_at      TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'matched', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pair_signals_open
  ON pair_signals (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_pair_signals_user
  ON pair_signals (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pair_signals_open_per_user
  ON pair_signals (user_id) WHERE status = 'open';

ALTER TABLE pair_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pair_signals_select_open ON pair_signals;
CREATE POLICY pair_signals_select_open ON pair_signals FOR SELECT USING (true);

DROP POLICY IF EXISTS pair_signals_insert_self ON pair_signals;
CREATE POLICY pair_signals_insert_self ON pair_signals FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS pair_signals_update_self ON pair_signals;
CREATE POLICY pair_signals_update_self ON pair_signals FOR UPDATE USING (true);

DROP POLICY IF EXISTS pair_signals_delete_self ON pair_signals;
CREATE POLICY pair_signals_delete_self ON pair_signals FOR DELETE USING (true);


-- ============================================================
-- 第 6 段：配对结果 pairings（只记录「双方都愿意」的结果）
-- ============================================================
CREATE TABLE IF NOT EXISTS pairings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a    UUID        REFERENCES pair_signals(id) ON DELETE SET NULL,
  signal_b    UUID        REFERENCES pair_signals(id) ON DELETE SET NULL,
  user_a      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'mutual', 'declined')),
  room_id     UUID,
  score       INTEGER     NOT NULL DEFAULT 0,
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pairings_not_self CHECK (user_a <> user_b)
);

CREATE INDEX IF NOT EXISTS idx_pairings_user_a ON pairings (user_a, matched_at DESC);
CREATE INDEX IF NOT EXISTS idx_pairings_user_b ON pairings (user_b, matched_at DESC);

ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pairings_select_own ON pairings;
CREATE POLICY pairings_select_own ON pairings FOR SELECT USING (true);

DROP POLICY IF EXISTS pairings_insert_self ON pairings;
CREATE POLICY pairings_insert_self ON pairings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS pairings_update_own ON pairings;
CREATE POLICY pairings_update_own ON pairings FOR UPDATE USING (true);


-- ============================================================
-- 第 7 段：双向确认 pair_decisions（双方都点「愿意」才成立）
-- ============================================================
CREATE TABLE IF NOT EXISTS pair_decisions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  decider_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision    TEXT        NOT NULL DEFAULT 'accept'
                          CHECK (decision IN ('accept', 'skip')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pair_decisions_not_self CHECK (decider_id <> target_id),
  CONSTRAINT pair_decisions_unique UNIQUE (decider_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_pair_decisions_target ON pair_decisions (target_id);
CREATE INDEX IF NOT EXISTS idx_pair_decisions_decider ON pair_decisions (decider_id);

ALTER TABLE pair_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pair_decisions_select_involved ON pair_decisions;
CREATE POLICY pair_decisions_select_involved ON pair_decisions FOR SELECT USING (true);

DROP POLICY IF EXISTS pair_decisions_insert_self ON pair_decisions;
CREATE POLICY pair_decisions_insert_self ON pair_decisions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS pair_decisions_update_self ON pair_decisions;
CREATE POLICY pair_decisions_update_self ON pair_decisions FOR UPDATE USING (true);


-- ============================================================
-- 第 8 段：漫展提交表 expo_requests（用户提交新漫展供管理员审核）
-- ============================================================
CREATE TABLE IF NOT EXISTS expo_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  start_at      TIMESTAMPTZ,
  end_at        TIMESTAMPTZ,
  venue_name    TEXT,
  venue_city    TEXT,
  official_url  TEXT,
  note          TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expo_requests_select_all ON expo_requests;
CREATE POLICY expo_requests_select_all ON expo_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS expo_requests_insert_self ON expo_requests;
CREATE POLICY expo_requests_insert_self ON expo_requests FOR INSERT WITH CHECK (true);


-- ============================================================
-- 第 9 段：messages 补 scope / scope_id 列
--   用途：区分「临时聊天」(temporary，同窗会内) 与「持久聊天」(persistent，好友)
--   trust_score 的「见面次数」维度靠 scope='temporary' + scope_id 统计。
--   缺列不阻塞发消息（insert 不写这两个字段），但 trust_score 会算不出见面次数。
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS scope TEXT
    CHECK (scope IS NULL OR scope IN ('temporary', 'persistent'));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS scope_id UUID;

CREATE INDEX IF NOT EXISTS idx_messages_scope
  ON messages (scope) WHERE scope IS NOT NULL;


-- ============================================================
-- 第 10 段：oc-artworks 存储桶说明（非 SQL，供参考）
-- ============================================================
-- oc-artworks 是 Supabase Storage 的 bucket（不是数据库表），
-- 用于存放 OC 卡的插画作品图片。若上传 OC 插画报错，请检查：
--   Storage → Buckets → 是否已建名为 `oc-artworks` 的 bucket（建议 public）。
-- 本迁移不涉及（Storage 配置需在 Dashboard 手动建，SQL 无法建 bucket）。


-- ============================================================
-- 执行完毕
-- ============================================================
-- 跑完后无需重打 APK（纯后端改动），直接重装/重开 App 测试发消息即可。
-- 若发消息仍失败，请在 App 里打开控制台看 insert 的具体报错，把报错发给我。
-- ============================================================
