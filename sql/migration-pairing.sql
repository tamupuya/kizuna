-- ============================================================
-- migration-pairing.sql — 双人配对（同窗会 v0.10，2026-10-03）
-- ============================================================
--
-- 五段独立可执行，按需在 Supabase SQL Editor 逐段运行。
-- 全部为新增（CREATE TABLE / ADD COLUMN），不改动既有数据，可安全重复执行。
--
-- 【重要】未执行本迁移时，前端【功能不中断】：
--   pairing.ts 的 openSignal / fetchOpenSignals 捕获错误后降级为纯本地模式，
--   配对流程仍可走通（只是匹配不到其他人，因为拿不到别人的信号）。
-- ============================================================


-- ---------- 第 1 段：信号池 pair_signals ----------
-- 「推窗」= 发布一条信号，表示我准备好了，愿意和此刻同样在场的人配对。
--
-- 【为什么单独一张表，不塞进 radar_rooms】
--   配对 ≠ 对话（用户拍板：「配对并不是对话，而是一些基本信息的交换」）。
--   骚扰发生在对话里，不在配对里。把两者拆开，才能在危险发生【之前】插一道门。
--   因此配对阶段不需要房间、不需要聊天记录、不需要 participants。

CREATE TABLE IF NOT EXISTS pair_signals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_want     TEXT[]      NOT NULL DEFAULT '{}',   -- 想认识 / 想一起做
  intent_provide  TEXT[]      NOT NULL DEFAULT '{}',   -- 我能提供
  expo_id         UUID        REFERENCES expos(id) ON DELETE SET NULL,  -- 线下才绑漫展
  time_window     INTEGER     NOT NULL DEFAULT 900,    -- 秒（180/900/3600/86400）
  expires_at      TIMESTAMPTZ NOT NULL,                -- created_at + time_window
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'matched', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 匹配查询的主力索引：按「开放中 + 未过期」过滤
CREATE INDEX IF NOT EXISTS idx_pair_signals_open
  ON pair_signals (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_pair_signals_user
  ON pair_signals (user_id);

-- 同一用户不应同时有多条开放信号（避免自己和自己抢匹配）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pair_signals_open_per_user
  ON pair_signals (user_id) WHERE status = 'open';


-- ---------- 第 2 段：配对结果 pairings ----------
--
-- 【只记录「双方都愿意」的结果】
--   跳过【不写任何记录】—— 这是「被跳过方无感」的代码实现。
--   不记录 = 不可见，反而更省事。
--
--   ⚠️ 对称性要求：pairings 表本身不暴露 skip 痕迹；
--   前端 skipSet 仅存在于本地 localStorage，且双向生效
--   （我跳过他 → 他也不会再看到他）。若把 skip 落库，
--   对方一旦能查到「谁跳过了我」，被跳过就从不可见变成可见，
--   这道门就从后面被撬开了。

CREATE TABLE IF NOT EXISTS pairings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a    UUID        REFERENCES pair_signals(id) ON DELETE SET NULL,
  signal_b    UUID        REFERENCES pair_signals(id) ON DELETE SET NULL,
  user_a      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'mutual', 'declined')),
  room_id     UUID,       -- 配对成功后由此开房（NULL = 尚未开房，是独立的一件事）
  score       INTEGER     NOT NULL DEFAULT 0,
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pairings_not_self CHECK (user_a <> user_b)
);

CREATE INDEX IF NOT EXISTS idx_pairings_user_a ON pairings (user_a, matched_at DESC);
CREATE INDEX IF NOT EXISTS idx_pairings_user_b ON pairings (user_b, matched_at DESC);


-- ---------- 第 3 段：radar_rooms 增加 mode / pairing_id ----------
-- mode：区分「多人聚集」与「双人配对后开房」两种房间语义
-- pairing_id：本房间由哪次配对开出（可追溯，也便于日后统计配对转化率）

ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'group'
    CHECK (mode IN ('group', 'pair'));

ALTER TABLE radar_rooms
  ADD COLUMN IF NOT EXISTS pairing_id UUID;


-- ---------- 第 4 段：RLS ----------
--
-- 信号池需要「所有人可读open信号」——这是配对的前提，
-- 否则拿不到别人的信号，匹配无从谈起。
--
-- 【隐私说明】本表只有意图/兴趣字段，【不含】联系方式、真实昵称、头像。
-- 因此开放读不会泄露联系方式。真实身份仍由 L0/L1/L2 分层控制
-- （见 pair_layers 与 MatchDetailView）。

ALTER TABLE pair_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pair_signals_select_open ON pair_signals;
CREATE POLICY pair_signals_select_open
  ON pair_signals FOR SELECT
  USING (true);   -- 人人可读（用于匹配 + 池子规模统计）

DROP POLICY IF EXISTS pair_signals_insert_self ON pair_signals;
CREATE POLICY pair_signals_insert_self
  ON pair_signals FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pair_signals_update_self ON pair_signals;
CREATE POLICY pair_signals_update_self
  ON pair_signals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pair_signals_delete_self ON pair_signals;
CREATE POLICY pair_signals_delete_self
  ON pair_signals FOR DELETE
  USING (user_id = auth.uid());


ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

-- 只能看到与自己有关的配对（A 或 B 两侧）
DROP POLICY IF EXISTS pairings_select_own ON pairings;
CREATE POLICY pairings_select_own
  ON pairings FOR SELECT
  USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS pairings_insert_self ON pairings;
CREATE POLICY pairings_insert_self
  ON pairings FOR INSERT
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS pairings_update_own ON pairings;
CREATE POLICY pairings_update_own
  ON pairings FOR UPDATE
  USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());


-- ---------- 第 5 段：双向确认 pair_decisions ----------
--
-- 【为什么需要单独一张表态表】
--   pair_signals 只能表示「有人在等」，不能表示「我愿意认识【你】」。
--   而用户拍板的配对规则是【双方都点愿意】—— 这需要一个能承载
--   「谁对谁表了什么态」的地方，否则无法判定双向。
--
-- 【为什么只存 accept】
--   skip 永不落库。「被跳过方无感 / 不可见」是硬约束：
--   一旦落库，对方可查「谁跳过了我」，这道门就从后面被撞开了。
--   所以本表的 decision 列虽留了 skip 枚举值（便于日后扩展），
--   但应用层【永远只写 accept】。
--
-- 【为什么不是自确认】
--   应用层只插 decider=自己、target=对方。不能替别人插行，
--   否则“双向确认”变成单方伪造双向——那是把保护机制变成漏洞。

CREATE TABLE IF NOT EXISTS pair_decisions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  decider_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision    TEXT        NOT NULL DEFAULT 'accept'
                          CHECK (decision IN ('accept', 'skip')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pair_decisions_not_self CHECK (decider_id <> target_id),
  -- 同一对关系只保留最新一次表态（重复点击不报错，直接更新）
  CONSTRAINT pair_decisions_unique UNIQUE (decider_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_pair_decisions_target
  ON pair_decisions (target_id);
CREATE INDEX IF NOT EXISTS idx_pair_decisions_decider
  ON pair_decisions (decider_id);


ALTER TABLE pair_decisions ENABLE ROW LEVEL SECURITY;

-- ⚠️ 关键：只能看到【与自己有关】的表态。
--   若允许所有人可读，就能查出「谁愿意认识谁」甚至「谁跳过了谁」，
--   同时破坏隐私与「被跳过不可见」两条规则。
DROP POLICY IF EXISTS pair_decisions_select_involved ON pair_decisions;
CREATE POLICY pair_decisions_select_involved
  ON pair_decisions FOR SELECT
  USING (decider_id = auth.uid() OR target_id = auth.uid());

-- 只能以【自己的身份】表态（不能替别人接受）
DROP POLICY IF EXISTS pair_decisions_insert_self ON pair_decisions;
CREATE POLICY pair_decisions_insert_self
  ON pair_decisions FOR INSERT
  WITH CHECK (decider_id = auth.uid());

DROP POLICY IF EXISTS pair_decisions_update_self ON pair_decisions;
CREATE POLICY pair_decisions_update_self
  ON pair_decisions FOR UPDATE
  USING (decider_id = auth.uid())
  WITH CHECK (decider_id = auth.uid());


-- ============================================================
-- 可选：惰性回收过期信号（与 radarStore「定时器 + 惰性回收」同一思路）
-- ============================================================-- 定时器在手机切后台/杀进程时不执行，会出现「房间/信号永久残留」。
-- 因此除了前端定时清理，建议再加一道惰性回收：读取时就地清理过期数据。
--
-- 若要启用，取消下面注释：

-- CREATE OR REPLACE FUNCTION cleanup_expired_pair_signals()
-- RETURNS void
-- LANGUAGE sql
-- SECURITY DEFINER
-- AS $$
--   UPDATE pair_signals
--      SET status = 'cancelled'
--    WHERE status = 'open'
--      AND expires_at < now();
-- $$;

-- 并可在 Supabase Dashboard → Database → Cron 里加定时任务调用它。
