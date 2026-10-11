/**
 * pairing.ts — 双人配对（同窗会 v0.10，2026-10-03）
 *
 * ================== 设计理念（用户拍板）==================
 *
 * 【自己的话】「配对并不是对话，而是一些基本信息的交换」
 *
 * 三段式：
 *   推窗（我准备好了）→ 配对（看到你是谁，接受/跳过）→ 开房（真正开始聊）
 *
 * 为什么把「配对」和「对话」拆开：
 *   骚扰发生在对话里，不在配对里。
 *   拆开 = 在危险发生【之前】插一道门；摇一摇原本是「摇到即开聊」，
 *   门开在危险【之后】，人已经进来了。
 *
 * 为什么配对阶段不需要消息体系：
 *   配对只是信息交换 → 不需要房间、不需要聊天记录、不需要 participants。
 *   所以本文件完全不依赖 messageStore，房间只在配对【成功之后】才出现。
 *
 * ================== 四条核心规则（用户拍板）==================
 *
 * ① 产品固定分层 + 每次配对决定走不走
 *    —— 保护是【默认态】：不设 ≠ 设为公开，而是不设就等于有保护。
 *    避开「隐私市场化」陷阱（每个人最优 = 别人开放我保守 → 要么没人匹配，要么全解锁）。
 *
 * ② 被跳过方【无感 / 不可见】
 *    —— 用户已主动承担代价（匹配时长变长、体感上可能反复被跳），
 *    判断保护价值优先。拒绝是可见的、跳过是不可见的；
 *    拒绝可能招致报复，跳过不会。
 *
 * ③ 配对成功【不排他】
 *    —— 排他会把产品推成约会软件（一对一、你等我我等你），
 *    而用户做的是「同好连接」。不排他 = 可以同时认识几个人 = 漫展扩列。
 *    天然限流：时间窗 + 同时在场同时在找，不会变成公共目录。
 *
 * ④ 产物【当场有效，过期即散】(方案 A)
 *    —— 卡片只在本次同窗会有效，时间窗一过即消失。
 *    理由：配对的产物是「我知道此刻有这个人」，这个信息过了此刻就没意义了。
 *    留下来反而会累积成负担（用户：「漫展扩列常变成列表尸体，不需要这种关系」）。
 */

import { supabase, isSupabaseConfigured } from './supabase'
import type { User } from './mockData'
import type { VenuePresence } from './venue'
import {
  interestScoreV3,
  intentScoreV3,
  identityScoreV3,
  areaScoreV3,
  computeExpoBonus,
} from './matching-v3'

// ============================================================
// 类型
// ============================================================

/** 一条「推窗」信号：我准备好了，愿意和此刻同样在场的人配对 */
export interface PairSignal {
  id: string
  user_id: string
  /** 想认识 / 想一起做 */
  intent_want: string[]
  /** 我能提供 */
  intent_provide: string[]
  /** 绑定的漫展（线下才填；线上/纯同好聊天为 null） */
  expo_id?: string | null
  /** 时间窗（秒） */
  time_window: number
  /** 有效期（ISO） */
  expires_at: string
  status: 'open' | 'matched' | 'cancelled'
  created_at: string
}

/** 一次配对的结果 */
export interface Pairing {
  id: string
  signal_a: string
  signal_b: string
  user_a: string
  user_b: string
  /** 双方都接受 → 'mutual'；一方跳过 → 不落库（不可见），故无 'skipped' 状态 */
  status: 'pending' | 'mutual' | 'declined'
  /** 配对成功后由此开房（null 表示尚未开房 —— 配对本身已完成，这是独立的一件事） */
  room_id?: string | null
  score: number
  matched_at: string
}

export type PairStage = 'idle' | 'waiting' | 'reviewing' | 'matched'

/**
 * 一次表态（双重确认的原子单位）
 *
 * ⚠️ 只有 'accept' 会落库，'skip' 永不落库（规则②：被跳过方不可见）
 */
export interface PairDecision {
  decider_id: string
  target_id: string
  decision: 'accept' | 'skip'
}

/**
 * 规范化的配对键（排序后拼接）—— 保证双方算出同一个键，
 * 否则 A→B 与 B→A 会各算一个键，互相看不到对方的表态。
 */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

/**
 * 双重确认：**双方都明确 accept** 才算配对成立
 *
 * 【为什么必须真的检查双方】
 * 用户拍板的是「双方都点『想认识』→ 才开房」。
 * 若单方一点就进入「你们看见了彼此」，那另一方的同意从未发生——
 * UI 在宣称一件没发生的事，与本项目最忌讳的「在场确认」谎言同属一类。
 *
 * 保护的价值恰恰在于：它会在没人同意时拦住你，也会在你单方面想推进时拦住你。
 */
export function isMutual(decisions: PairDecision[], a: string, b: string): boolean {
  const aToB = decisions.some(
    d => d.decider_id === a && d.target_id === b && d.decision === 'accept'
  )
  const bToA = decisions.some(
    d => d.decider_id === b && d.target_id === a && d.decision === 'accept'
  )
  return aToB && bToA
}

/** 我是否已对 TA 表过态（无论接受还是跳过） */
export function hasDecided(decisions: PairDecision[], me: string, target: string): boolean {
  return decisions.some(d => d.decider_id === me && d.target_id === target)
}

/** 配对打分结果（用于「为什么推荐这个人」文案） */
export interface PairCandidate {
  user: User
  score: number
  reasons: string[]
}

// ============================================================
// 本地降级（Supabase 未配置 / 离线时使用）
// ============================================================

const LOCAL_SIGNAL_KEY = 'kizuna.pair.signal'
const LOCAL_SKIP_KEY = 'kizuna.pair.skipped'
const LOCAL_SEEN_KEY = 'kizuna.pair.seen'
/**
 * 我的表态（只存 accept；skip 归入 LOCAL_SKIP_KEY）
 * 结构：{ [candidateUserId]: 'accept' }
 */
const LOCAL_DECISION_KEY = 'kizuna.pair.decision'

/**
 * 跳过名单（本地，不落库）
 *
 * 规则②：被跳过方无感 → 跳过【不写任何记录】。
 * 这是默认行为，反而更省代码 —— 不记录就是不可见。
 *
 * 但仍需本地记住「跳过谁」，否则同一人会反复出现。
 * ⚠️ 对称性：本名单必须【双向】生效（对方也不会再看到我），
 * 否则「怎么老是他」会反向泄露「你可能是被跳过的那个」，
 * 等于从后面把「被跳过不可见」这道门撬开。
 */
function loadSkipSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_SKIP_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveSkipSet(set: Set<string>) {
  try {
    localStorage.setItem(LOCAL_SKIP_KEY, JSON.stringify([...set]))
  } catch {
    /* 忽略 */
  }
}

function loadLocalSignal(): PairSignal | null {
  try {
    const raw = localStorage.getItem(LOCAL_SIGNAL_KEY)
    return raw ? (JSON.parse(raw) as PairSignal) : null
  } catch {
    return null
  }
}

/** 读取我的全部表态（仅 accept 会落在这里） */
function loadDecisionMap(): Record<string, 'accept'> {
  try {
    const raw = localStorage.getItem(LOCAL_DECISION_KEY)
    return raw ? (JSON.parse(raw) as Record<string, 'accept'>) : {}
  } catch {
    return {}
  }
}

/**
 * 已表态的人（接受 + 跳过）
 *
 * 这两者都要从候选中排除，但【处理方式不同】：
 *   - 跳过 → 不落库（被跳过方不可见）
 *   - 接受 → 可落库（对方需要知道「有人愿意认识你」才能做双向确认）
 * 排除只是为了不重复推同一个人，与隐私无关。
 */
function loadDecidedIds(userId?: string): Set<string> {
  const set = loadSkipSet()
  for (const k of Object.keys(loadDecisionMap())) set.add(k)
  // 兼容：已接受名单也排除（防止 markSeen 与 decision 两侧不同步）
  if (userId) {
    try {
      const raw = localStorage.getItem(LOCAL_SEEN_KEY)
      const arr: string[] = raw ? JSON.parse(raw) : []
      for (const id of arr) set.add(id)
    } catch {
      /* 忽略 */
    }
  }
  return set
}

function saveLocalSignal(s: PairSignal | null) {
  try {
    if (s) localStorage.setItem(LOCAL_SIGNAL_KEY, JSON.stringify(s))
    else localStorage.removeItem(LOCAL_SIGNAL_KEY)
  } catch {
    /* 忽略 */
  }
}

// ============================================================
// 配对打分（复用 matching-v3 的既有维度，不新造轮子）
// ============================================================

/**
 * 计算两个信号持有者的配对分
 *
 * 权重沿用「意图优先」原则（用户拍板）：
 *   兴趣是不易改动的长期项，意图是临时项。
 *   双方任一填了意图 → 意图升为主导 45%，兴趣退居兜底 35%
 *   都没填意图 → 兴趣主导 45%，维持原行为
 *
 * 漫展加分复用 computeExpoBonus（同场同日同时段 +30 / 同日 +22 / 仅在场地 +15）
 */
export function scorePair(args: {
  me: User
  other: User
  mySignal: PairSignal
  theirSignal: PairSignal
  allPresences?: VenuePresence[]
  expoVenueMap?: Record<string, string>
  expoTitleMap?: Record<string, string>
}): PairCandidate {
  const { me, other, mySignal, theirSignal, allPresences = [], expoVenueMap = {}, expoTitleMap = {} } = args

  const interest = interestScoreV3(me, other)
  const intent = intentScoreV3(me, other)
  const identity = identityScoreV3(me, other)
  const area = areaScoreV3(me, other)

  const anyIntent =
    (mySignal.intent_want?.length || 0) > 0 ||
    (mySignal.intent_provide?.length || 0) > 0 ||
    (theirSignal.intent_want?.length || 0) > 0 ||
    (theirSignal.intent_provide?.length || 0) > 0

  const base = anyIntent
    ? intent * 0.45 + interest.total * 0.35 + area.total * 0.10 + identity * 0.10
    : interest.total * 0.45 + intent * 0.25 + area.total * 0.15 + identity * 0.15

  // 漫展加分：复用既有逻辑。
  // ⚠️ computeExpoBonus 内部会用 room.initiator_id 去查【对方】的在场记录，
  // 因此必须传入对方的 user id；传假对象会导致永远拿 15 分兵底。
  const expoBonus = computeExpoBonus({
    room: { expo_id: theirSignal.expo_id ?? null, initiator_id: other.id } as never,
    currentUser: me,
    allPresences,
    expoVenueMap,
    expoTitleMap,
  })

  const total = Math.min(100, Math.round(base + expoBonus.score))

  const reasons: string[] = []
  if (expoBonus.reason) reasons.push(expoBonus.reason)
  if (anyIntent && intent >= 8) reasons.push('意图互补')
  if (interest.total >= 10) reasons.push(`兴趣相近 ${Math.round(interest.total)}%`)
  else if (interest.works > 0) reasons.push('有共同作品')
  if (area.city > 0) reasons.push('同城')
  if (identity >= 8) reasons.push('身份接近')

  return { user: other, score: total, reasons: reasons.slice(0, 3) }
}

/**
 * 从候选池中为「我」挑一个匹配对象
 *
 * 规则②落地：跳过的人【静默排除】，且对方不会被通知。
 * 排除项：自己 / NG 用户 / 已过期信号 / 已跳过 / 已配对成功过的
 */
export function pickBestMatch(args: {
  me: User
  mySignal: PairSignal
  signals: PairSignal[]
  users: User[]
  skipSet?: Set<string>
  /**
   * 已表过态的人（已接受 / 已跳过）—— 必须排除
   *
   * 规则③「不排他」的意思是「可以同时认识【别人】」，
   * 不是「同一个人反复出现」。若不排除：「再看看别人」会一直推同一个人 → 当场死循环。
   */
  excludeUserIds?: Set<string>
  allPresences?: VenuePresence[]
  expoVenueMap?: Record<string, string>
  expoTitleMap?: Record<string, string>
}): PairCandidate | null {
  const {
    me,
    mySignal,
    signals,
    users,
    skipSet = new Set<string>(),
    excludeUserIds,
    allPresences = [],
    expoVenueMap = {},
    expoTitleMap = {},
  } = args

  const nowIso = new Date().toISOString()
  const userMap = new Map(users.map(u => [u.id, u]))

  // 跳过名单 + 已表态名单，合并为一份排除集
  const decided = excludeUserIds ?? loadDecidedIds(me.id)

  const candidates = signals
    .filter(s => s.status === 'open' && s.expires_at > nowIso)
    .filter(s => s.user_id !== me.id)
    .filter(s => !skipSet.has(s.user_id))
    .filter(s => !decided.has(s.user_id))
    .filter(s => {
      const u = userMap.get(s.user_id)
      if (!u) return false
      // NG 绝对屏蔽（与 skip 不同：这是双方向的硬过滤）
      if (u.ng_tags && u.ng_tags.length > 0) return false
      return true
    })
    .map(s => {
      const other = userMap.get(s.user_id)!
      return scorePair({
        me,
        other,
        mySignal,
        theirSignal: s,
        allPresences,
        expoVenueMap,
        expoTitleMap,
      })
    })
    // ⚠️ 此处【不能】用 score > 0 过滤候选。
    //
    // 【测试发现的真实缺陷】若二人无任何可量化交集，score === 0，
    // 过滤掉后 pickBestMatch 返回 null —— 用户看到的是「没人」。
    // 而 P0 场景是【一场漫展几十人】，小池子里「无交集」是常态而非例外，
    // 于是产品会经常表现为「零匹配」。更致命的是：
    // 用户分不清「池里真没人」和「有但被算法滤掉了」，两者长得一样。
    //
    // 第一性原理：推开窗这个动作【本身】就是信号。
    // 「此刻我们都在这里」已经是一条真实的连接，不需要算法背书。
    // 分数只用于【排序】，不该用于【许可】——算法是排序器，不是门卫。
    .sort((a, b) => b.score - a.score)

  return candidates[0] ?? null
}

/**
 * 池子规模（规则②的缓解措施）
 *
 * 用户主动承担了「匹配时长变长」的代价，但有个风险必须配一个东西：
 * 左滑式不可见过滤成立的前提是【池子够大】（约会 app 百万级）。
 * P0 场景是【一场漫展 ≈ 几十人】，双向不可见过滤 × 小池子
 * → 可能一次都匹配不上，且双方都不知道为何。
 *
 * 致命处：用户分不清「池子里没人」和「我被跳过了」——两种情况长得一模一样，
 * 都是干等。于是「越保护 → 越容易零匹配 → 用户以为这产品没人用 → 走掉」，
 * 保护机制本身会把用户赶走。
 *
 * 解法：显示【聚合规模】，不显示是谁。
 *   - 聚合值不泄露任何个体，不破坏「被跳过不可见」
 *   - 把「黑等」变成「可行动的等」
 *   - 池子为 0 时也诚实：那是真的没人，不是你的问题
 */
export function countOpenSignals(signals: PairSignal[], excludeUserId?: string): number {
  const nowIso = new Date().toISOString()
  return signals.filter(
    s =>
      s.status === 'open' &&
      s.expires_at > nowIso &&
      (!excludeUserId || s.user_id !== excludeUserId)
  ).length
}

// ============================================================
// 数据访问层（Supabase 优先，本地降级）
// ============================================================

export const usePairing = () => {
  /** 拉取所有开放信号（用于匹配 + 统计池子规模） */
  async function fetchOpenSignals(): Promise<PairSignal[]> {
    if (!isSupabaseConfigured()) return []
    try {
      const { data, error: err } = await supabase.from('pair_signals').select('*')
      if (err) {
        console.warn('[pairing] fetchOpenSignals error:', err.message)
        return []
      }
      return (data || []) as PairSignal[]
    } catch (e) {
      console.warn('[pairing] fetchOpenSignals exception:', e)
      return []
    }
  }

  /** 推窗：发布一条信号（我准备好了） */
  async function openSignal(args: {
    userId: string
    intentWant: string[]
    intentProvide: string[]
    expoId?: string | null
    timeWindow: number
  }): Promise<PairSignal> {
    const { userId, intentWant, intentProvide, expoId = null, timeWindow } = args
    const now = Date.now()
    const signal: PairSignal = {
      id: crypto.randomUUID?.() || `sig-${now}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      intent_want: intentWant,
      intent_provide: intentProvide,
      expo_id: expoId,
      time_window: timeWindow,
      expires_at: new Date(now + timeWindow * 1000).toISOString(),
      status: 'open',
      created_at: new Date(now).toISOString(),
    }

    if (isSupabaseConfigured()) {
      const { error: err } = await supabase.from('pair_signals').insert(signal)
      if (err) {
        // 表不存在（迁移未执行）时降级为纯本地，功能不中断
        console.warn('[pairing] openSignal insert 失败（降级本地）:', err.message)
      }
    }
    saveLocalSignal(signal)
    return signal
  }

  /** 关窗：撤下自己的信号 */
  async function closeSignal(signalId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const { error: err } = await supabase
        .from('pair_signals')
        .update({ status: 'cancelled' })
        .eq('id', signalId)
      if (err) console.warn('[pairing] closeSignal 失败:', err.message)
    }
    saveLocalSignal(null)
  }

  /**
   * 跳过：规则②——不写任何记录。
   * 只写本地 skipSet（不进库），保证「被跳过方不可见」。
   */
  function skipUser(userId: string): void {
    const set = loadSkipSet()
    set.add(userId)
    saveSkipSet(set)
    // 对称性：本地方向也记住「我在被这些人跳过」是无法知道的，
    // 但至少保证自己不再看到对方（双向不可见的最小实现）
  }

  function getSkipSet(): Set<string> {
    return loadSkipSet()
  }

  /** 读取本地信号（降级 / 恢复现场） */
  function getLocalSignal(): PairSignal | null {
    return loadLocalSignal()
  }

  /** 记录「已见过并接受」的人（本次同窗会内有效，方案 A） */
  function markSeen(userId: string) {
    try {
      const raw = localStorage.getItem(LOCAL_SEEN_KEY)
      const arr: string[] = raw ? JSON.parse(raw) : []
      if (!arr.includes(userId)) {
        arr.push(userId)
        localStorage.setItem(LOCAL_SEEN_KEY, JSON.stringify(arr))
      }
    } catch {
      /* 忽略 */
    }
  }

  /**
   * 我接受某人（双重确认的【第一方】）
   *
   * 只记录「我愿意」——**不**在此判定配对成立。
   * 必须等对方也 accept（isMutual）才能说「你们看见了彼此」。
   */
  function acceptUser(userId: string): void {
    try {
      const map = loadDecisionMap()
      map[userId] = 'accept'
      localStorage.setItem(LOCAL_DECISION_KEY, JSON.stringify(map))
    } catch {
      /* 忽略 */
    }
  }

  /** 我是否已对某人表过态 */
  function hasDecidedMy(userId: string): boolean {
    return !!loadDecisionMap()[userId] || loadSkipSet().has(userId)
  }

  /** 已表态的人（接受 + 跳过）—— 防止同一个人被反复推出 */
  function getDecidedIds(): Set<string> {
    return loadDecidedIds()
  }

  /** 拉取与我相关的表态（用于判定双向确认） */
  async function fetchDecisions(): Promise<PairDecision[]> {
    if (!isSupabaseConfigured()) return []
    try {
      const { data, error: err } = await supabase.from('pair_decisions').select('*')
      if (err) {
        console.warn('[pairing] fetchDecisions error:', err.message)
        return []
      }
      return (data || []) as PairDecision[]
    } catch (e) {
      console.warn('[pairing] fetchDecisions exception:', e)
      return []
    }
  }

  /** 写入我的 accept 表态（skip 永不写入） */
  async function persistDecision(userId: string, targetId: string): Promise<void> {
    if (!isSupabaseConfigured()) return
    try {
      const { error: err } = await supabase
        .from('pair_decisions')
        .insert({ decider_id: userId, target_id: targetId, decision: 'accept' })
      if (err) console.warn('[pairing] persistDecision 失败（降级本地）:', err.message)
    } catch (e) {
      console.warn('[pairing] persistDecision exception:', e)
    }
  }

  /** 本次同窗会内已接受的人（卡片展示用；过期即散，不做长期列表） */
  function getSeen(): string[] {
    try {
      const raw = localStorage.getItem(LOCAL_SEEN_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  }

  /** 清空本次会面痕迹（时间窗结束 / 离开房间时调用，落实「过期即散」） */
  function clearSeen() {
    try {
      localStorage.removeItem(LOCAL_SEEN_KEY)
      localStorage.removeItem(LOCAL_DECISION_KEY)
    } catch {
      /* 忽略 */
    }
  }

  return {
    fetchOpenSignals,
    openSignal,
    closeSignal,
    skipUser,
    getSkipSet,
    getLocalSignal,
    markSeen,
    getSeen,
    clearSeen,
    acceptUser,
    hasDecidedMy,
    getDecidedIds,
    fetchDecisions,
    persistDecision,
  }
}

/**
 * 双重确认（用户拍板）：
 *   第一道 = 我愿意让【这个人】看到我（配对阶段）
 *   第二道 = 我愿意【现在】开始说话（开房阶段）
 *
 * 两道门问的是不同的事，才不重复：
 *   关于「这个人」 vs 关于「此刻」
 *   交换信息       vs 投入时间
 *
 * 若两道门都问「你愿不愿意和这个人交流」，第二道就是废话。
 */
export const PAIR_LAYERS = [
  { level: 0, label: '仅模糊摘要', desc: '同窗会共同点（模糊）' },
  { level: 1, label: '已分享对方查看', desc: '人设卡可见' },
  { level: 2, label: '已获得完整访问权', desc: '联系方式可见' },
] as const

// ============================================================
// 自检（开发期用，生产构建会被 tree-shake）
// ============================================================

/**
 * 纯函数级自检：验证配对核心逻辑在无网络、无 Supabase 时仍正确
 * 这是「保证代码运行」的最低成本验证方式之一
 */
export function selfTestPairing(): { pass: boolean; cases: string[] } {
  const cases: string[] = []
  let pass = true

  const mkUser = (id: string, over: Partial<User> = {}): User => ({
    id,
    cn: id,
    avatar_url: '',
    bio: '',
    gender: 'private',
    identity_tags: [],
    interest_tags: [],
    ...over,
  } as User)

  const mkSignal = (uid: string, over: Partial<PairSignal> = {}): PairSignal => ({
    id: `sig-${uid}`,
    user_id: uid,
    intent_want: [],
    intent_provide: [],
    expo_id: null,
    time_window: 900,
    expires_at: new Date(Date.now() + 900_000).toISOString(),
    status: 'open',
    created_at: new Date().toISOString(),
    ...over,
  })

  // 1. 池子规模只数 open 且未过期
  const sigs = [
    mkSignal('a'),
    mkSignal('b', { status: 'matched' }),
    mkSignal('c', { expires_at: new Date(Date.now() - 1000).toISOString() }),
  ]
  if (countOpenSignals(sigs) !== 1) {
    cases.push('FAIL: countOpenSignals 应只计 open 且未过期')
    pass = false
  } else {
    cases.push('OK: countOpenSignals 过滤 matched/expired')
  }

  // 2. 跳过的人必须被静默排除（规则②）
  const me = mkUser('me')
  const pick = pickBestMatch({
    me,
    mySignal: mkSignal('me'),
    signals: [mkSignal('x'), mkSignal('y')],
    users: [mkUser('x'), mkUser('y')],
    skipSet: new Set(['x']),
  })
  if (pick && pick.user.id === 'x') {
    cases.push('FAIL: 跳过的人仍被匹配（破坏「被跳过不可见」）')
    pass = false
  } else {
    cases.push('OK: 跳过的人被静默排除')
  }

  // 3. NG 用户必须硬过滤（与 skip 不同）
  const ngPick = pickBestMatch({
    me,
    mySignal: mkSignal('me'),
    signals: [mkSignal('ng')],
    users: [mkUser('ng', { ng_tags: ['雷点'] })],
  })
  if (ngPick) {
    cases.push('FAIL: NG 用户未被过滤')
    pass = false
  } else {
    cases.push('OK: NG 用户硬过滤')
  }

  // 4. 自己不能被匹配到自己
  const selfPick = pickBestMatch({
    me,
    mySignal: mkSignal('me'),
    signals: [mkSignal('me')],
    users: [me],
  })
  if (selfPick) {
    cases.push('FAIL: 匹配到了自己')
    pass = false
  } else {
    cases.push('OK: 不会匹配自己')
  }

  // 5. 打分应在 0-100 之间
  const s = scorePair({
    me: mkUser('me', { identity_tags: ['coser'] }),
    other: mkUser('o', { identity_tags: ['coser'] }),
    mySignal: mkSignal('me', { intent_want: ['逛展'] }),
    theirSignal: mkSignal('o', { intent_provide: ['逛展'] }),
  })
  if (!(s.score >= 0 && s.score <= 100)) {
    cases.push(`FAIL: score 越界 (${s.score})`)
    pass = false
  } else {
    cases.push(`OK: score 在 0-100 内 (${s.score})`)
  }

  return { pass, cases }
}
