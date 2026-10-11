/**
 * Matching algorithm v3 — 2026-08-09 P0-B 雷达精进
 *
 * 合并自 matching-v2（五维权重）+ radar-v3（短时在场加权）
 *
 * 总分 = 100:
 *   - Scene 场景 (30): 同场+同时段 30 / 同场同日 22 / 同想去 18 / 同去过 12 / 同城 10
 *   - Interest 兴趣 (25): 分类交集 × 14 + 作品交集 × 11
 *   - Intent 意图 (20): 双向互补 (give_you × 10 + you_give_me × 10)
 *   - Identity 身份 (15): Jaccard of identity_tags
 *   - Area 地区 (10): 同区 6 / 同市 3 / 同省 1
 *
 * 短时参数（P0-B 新增）:
 *   - timeWindow: 1min / 5min / 30min / 24h（基于 last_active_at 过滤）
 *   - geoRadius: 0 (不限) / 5 / 10 / 50 km
 *   - tags: 自定义标签过滤
 *   - venueId: 当前漫展 ID（在场雷达优先）
 *
 * 输出:
 *   - 4 桶分池 onSite/upcoming/city/global
 *   - reasons[] 场景化文案
 *   - virtual_id 周稳定短链
 *   - same_venue 共同场地信息
 *
 * 不得做：
 *   - 不显示真实姓名 / 头像 / 联系方式（L0 默认）
 *   - NG 用户永远过滤
 */

import type { Expo, User, RadarRoom } from './mockData'
import type { VenuePresence } from './venue'
import { getVirtualIdLocal } from './virtualId'
import { TIME_SLOT_LABEL, type TimeSlot } from './venue'
import { calculateTrustScore, type TrustScoreInput } from './trustScore'

export interface RadarCandidateV3 {
  user_id: string
  virtual_id: string
  score: number
  scene: number
  interest: number
  intent: number
  identity: number
  area: number
  reasons: string[]
  sceneBucket: 'onSite' | 'upcoming' | 'city' | 'global'
  same_venue?: {
    venue_id: string
    venue_name: string
    date?: string
    time_slot?: TimeSlot
  }
}

export interface MatchSearchParams {
  tags: string[]
  timeWindowSeconds: number
  geoRadiusKm: number
  venueId?: string
  currentUserId: string
  currentUserArea?: string
  allUsers: User[]
  allPresences: VenuePresence[]
  allExpos: Expo[]
  perBucket?: number
  /** P0-C: 可选 trustScore 字典 (userId → TrustScoreInput) */
  trustScores?: Record<string, TrustScoreInput>
}

// ========== 基础工具 ==========

// ========== 各维度打分（v0.10 起导出，供配对流程 pairing.ts 复用） ==========

export function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0
  const sa = new Set(a)
  const sb = new Set(b)
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter++
  const uni = sa.size + sb.size - inter
  return uni === 0 ? 0 : inter / uni
}

function parseArea(area?: string): { city: string; region: string } {
  if (!area) return { city: '', region: '' }
  const parts = area.split(/\s+/).filter(Boolean)
  return { city: parts[0] || '', region: parts[1] || '' }
}

export function sharedWorksCount(me: User, other: User): number {
  const myWorks = new Set<string>()
  ;(me.interest_categories || []).forEach(c => c.works.forEach(w => myWorks.add(w)))
  const theirWorks = new Set<string>()
  ;(other.interest_categories || []).forEach(c => c.works.forEach(w => theirWorks.add(w)))
  let shared = 0
  for (const w of myWorks) if (theirWorks.has(w)) shared++
  return shared
}

// ========== 场景维度 ==========

interface SceneResult {
  score: number
  bucket: RadarCandidateV3['sceneBucket']
  same_venue?: RadarCandidateV3['same_venue']
  reasonText?: string
}

function sceneScoreV3(
  me: User,
  other: User,
  myPresences: VenuePresence[],
  theirPresences: VenuePresence[],
  expoMap: Map<string, Expo>,
  targetVenueId?: string,
): SceneResult {
  // 在场雷达：指定 venue 时优先匹配
  if (targetVenueId) {
    const myOnsite = myPresences.find(
      p => p.venue_id === targetVenueId && p.status === 'onsite'
    )
    const theirOnsite = theirPresences.find(
      p => p.venue_id === targetVenueId && p.status === 'onsite'
    )

    if (myOnsite && theirOnsite) {
      const expo = expoMap.get(targetVenueId)
      const venueName = expo?.title || '当前漫展'

      // 同日期 + 同时段 → 30 分（最高）
      if (myOnsite.visit_date === theirOnsite.visit_date &&
          myOnsite.time_slot === theirOnsite.time_slot) {
        return {
          score: 30,
          bucket: 'onSite',
          same_venue: {
            venue_id: targetVenueId,
            venue_name: venueName,
            date: myOnsite.visit_date || undefined,
            time_slot: myOnsite.time_slot || undefined,
          },
          reasonText: `同在 ${venueName} ${myOnsite.visit_date || ''} ${myOnsite.time_slot ? TIME_SLOT_LABEL[myOnsite.time_slot] : ''}`,
        }
      }
      // 同日不同时段 → 22 分
      if (myOnsite.visit_date === theirOnsite.visit_date) {
        return {
          score: 22,
          bucket: 'onSite',
          same_venue: {
            venue_id: targetVenueId,
            venue_name: venueName,
            date: myOnsite.visit_date || undefined,
          },
          reasonText: `同在 ${venueName} ${myOnsite.visit_date || ''}`,
        }
      }
    }
  }

  // 通用场景：同想去的展
  const myWishlist = myPresences.filter(p => p.status === 'wishlist')
  const theirWishlist = theirPresences.filter(p => p.status === 'wishlist')
  const sameWishlist = myWishlist.filter(m =>
    theirWishlist.some(t => t.venue_id === m.venue_id)
  )
  if (sameWishlist.length > 0) {
    const expo = expoMap.get(sameWishlist[0].venue_id)
    const title = expo?.title || '漫展'
    return {
      score: 18,
      bucket: 'upcoming',
      reasonText: `都想去看 ${title}`,
    }
  }

  // 同去过
  const myVisited = myPresences.filter(p => p.status === 'visited')
  const theirVisited = theirPresences.filter(p => p.status === 'visited')
  if (myVisited.some(m => theirVisited.some(t => t.venue_id === m.venue_id))) {
    return {
      score: 12,
      bucket: 'city',
      reasonText: '去过相同的漫展',
    }
  }

  // 同城
  const myArea = parseArea(me.activity_area)
  const theirArea = parseArea(other.activity_area)
  if (myArea.city && theirArea.city && myArea.city === theirArea.city) {
    return {
      score: 10,
      bucket: 'city',
      reasonText: `同城：${myArea.city}`,
    }
  }

  // 其他
  return { score: 0, bucket: 'global' }
}

// ========== 兴趣维度 ==========

export function interestScoreV3(me: User, other: User): { total: number; cat: number; works: number } {
  const myCats = (me.interest_categories || []).filter(c => c && c.name).map(c => c.name)
  const theirCats = (other.interest_categories || []).filter(c => c && c.name).map(c => c.name)
  const cat = Math.round(jaccard(myCats, theirCats) * 14)

  const shared = sharedWorksCount(me, other)
  const myWorkCount = (me.interest_categories || []).reduce((sum, c) => sum + c.works.length, 0)
  const theirWorkCount = (other.interest_categories || []).reduce((sum, c) => sum + c.works.length, 0)
  const maxWorks = Math.max(6, myWorkCount, theirWorkCount)
  const works = Math.round((shared / maxWorks) * 11)

  return { total: Math.min(25, cat + works), cat, works }
}

// ========== 意图维度 ==========

export function intentScoreV3(me: User, other: User): number {
  const iProvide = new Set(me.intent_provide || [])
  const youWant = new Set(other.intent_want || [])
  const iWant = new Set(me.intent_want || [])
  const youProvide = new Set(other.intent_provide || [])

  let giveYou = 0
  for (const x of iProvide) if (youWant.has(x)) giveYou++
  let youGiveMe = 0
  for (const x of youProvide) if (iWant.has(x)) youGiveMe++

  const intentTotal = (me.intent_want?.length || 0) + (other.intent_want?.length || 0)
  if (intentTotal === 0) return 0

  return Math.round(((giveYou + youGiveMe) / intentTotal) * 20)
}

// ========== 身份维度 ==========

export function identityScoreV3(me: User, other: User): number {
  return Math.round(jaccard(me.identity_tags || [], other.identity_tags || []) * 15)
}

// ========== 地区维度 ==========

export function areaScoreV3(me: User, other: User): { total: number; city: number; region: number } {
  const myArea = parseArea(me.activity_area)
  const theirArea = parseArea(other.activity_area)
  let city = 0
  let region = 0
  if (myArea.city && theirArea.city) {
    if (myArea.city === theirArea.city) {
      city = 3
      if (myArea.region && theirArea.region && myArea.region === theirArea.region) {
        region = 3  // 同区额外 +3（合计 6）
      }
    }
  }
  return { total: city + region, city, region }
}

// ========== 主入口 ==========

export interface SceneBucketsV3 {
  onSite: RadarCandidateV3[]
  upcoming: RadarCandidateV3[]
  city: RadarCandidateV3[]
  global: RadarCandidateV3[]
}

export function searchRadarV3(params: MatchSearchParams): SceneBucketsV3 {
  const {
    tags,
    timeWindowSeconds,
    geoRadiusKm,
    venueId,
    currentUserId,
    currentUserArea,
    allUsers,
    allPresences,
    allExpos,
    perBucket = 3,
  } = params

  const expoMap = new Map(allExpos.map(e => [e.id, e]))
  const me = allUsers.find(u => u.id === currentUserId)
  if (!me) {
    return { onSite: [], upcoming: [], city: [], global: [] }
  }

  const myPresences = allPresences.filter(p => p.user_id === currentUserId)
  const now = Date.now()
  const windowMs = timeWindowSeconds * 1000

  // 1. 过滤：排除自己 + NG 用户 + 时间窗 + 同城
  const filtered = allUsers.filter(u => {
    if (u.id === currentUserId) return false
    if (u.ng_tags && u.ng_tags.length > 0) return false
    if (u.last_active_at) {
      const lastActive = new Date(u.last_active_at).getTime()
      if (now - lastActive > windowMs) return false
    }
    if (geoRadiusKm > 0 && currentUserArea && u.activity_area !== currentUserArea) {
      return false
    }
    return true
  })

  // 2. 评分
  const scored: RadarCandidateV3[] = filtered.map(other => {
    const theirPresences = allPresences.filter(p => p.user_id === other.id)
    const scene = sceneScoreV3(me, other, myPresences, theirPresences, expoMap, venueId)
    const interest = interestScoreV3(me, other)
    const intent = intentScoreV3(me, other)
    const identity = identityScoreV3(me, other)
    const area = areaScoreV3(me, other)

    let total = scene.score + interest.total + intent + identity + area.total

    // P0-C: trust_score 加成（最高 +4 分）
    if (params.trustScores && params.trustScores[other.id]) {
      const ts = calculateTrustScore(params.trustScores[other.id])
      total += ts.radarBonus
    }

    total = Math.min(100, total)

    const reasons: string[] = []
    if (scene.reasonText) reasons.push(scene.reasonText)

    const shared = sharedWorksCount(me, other)
    if (shared > 0) reasons.push(`共同作品 × ${shared}`)

    if (identity > 0) {
      const sharedIds = (me.identity_tags || []).filter(x => (other.identity_tags || []).includes(x))
      if (sharedIds.length) reasons.push(`同是 ${sharedIds[0]}`)
    }

    if (tags.length > 0) {
      const theirInterests = new Set([...(other.interest_tags || []), ...(other.intent_want || [])])
      const matched = tags.filter(t => theirInterests.has(t))
      if (matched.length > 0) reasons.push(`tag 匹配：${matched.slice(0, 2).join('、')}`)
    }

    return {
      user_id: other.id,
      virtual_id: getVirtualIdLocal(other.id),
      score: total,
      scene: scene.score,
      interest: interest.total,
      intent,
      identity,
      area: area.total,
      reasons,
      sceneBucket: scene.bucket,
      same_venue: scene.same_venue,
    }
  })

  // 3. 分桶
  const buckets: SceneBucketsV3 = {
    onSite: [],
    upcoming: [],
    city: [],
    global: [],
  }
  for (const c of scored) {
    buckets[c.sceneBucket].push(c)
  }

  // 4. 桶内排序 + 截取
  for (const key of Object.keys(buckets) as Array<keyof SceneBucketsV3>) {
    buckets[key].sort((a, b) => b.score - a.score)
    buckets[key] = buckets[key].slice(0, perBucket)
  }

  return buckets
}

/** 展开为单一排序列表（兼容旧 API） */
// ============================================
// searchRadarRooms（v0.9.13）：按"发起人 vs 我"的兴趣匹配度排序房间
// ============================================

export interface RadarRoomCandidate {
  room: RadarRoom
  initiator: User
  score: number                  // 0-100
  reasons: string[]              // 排序依据（最多 3 条）
  match_tags: string[]           // 共同兴趣
}

/**
 * 线下同窗会绑定漫展后的加分（v0.10，2026-10-03）
 *
 * 分级（取最高成立的一档）：
 *   30  双方同场同日同时段
 *   22  双方同场同日（无时段信息）
 *   15  只有「我」在这一场（读不到发起人 presence 时的兵底）
 *    0  未绑漫展 / 我不在场
 *
 * 降级说明：venue_presence 默认只加载自己的记录（loadMyPresences），
 * 读全体记录需 RLS 开放（fetchAllPresences 为 best-effort）。
 * 因此当读不到发起人 presence 时，只能拿到 15 分兵底——
 * 此时文案也只说「你也在这场」，不说「你们都在」，避免虚假陈述。
 */
export function computeExpoBonus(args: {
  room: RadarRoom
  currentUser: User
  allPresences: VenuePresence[]
  expoVenueMap: Record<string, string>
  expoTitleMap: Record<string, string>
}): { score: number; reason: string | null } {
  const { room, currentUser, allPresences, expoVenueMap, expoTitleMap } = args
  if (!room.expo_id) return { score: 0, reason: null }

  const venueId = expoVenueMap[room.expo_id]
  if (!venueId) return { score: 0, reason: null }

  const venueName = expoTitleMap[room.expo_id] || '同一场漫展'

  const myOnsite = allPresences.find(
    p => p.user_id === currentUser.id && p.venue_id === venueId && p.status === 'onsite'
  )
  if (!myOnsite) return { score: 0, reason: null }

  // best-effort：发起人的在场记录（RLS 未开放时读不到）
  const theirOnsite = allPresences.find(
    p => p.user_id === room.initiator_id && p.venue_id === venueId && p.status === 'onsite'
  )
  if (!theirOnsite) {
    return { score: 15, reason: `你也在这场` }
  }

  if (myOnsite.visit_date && theirOnsite.visit_date &&
      myOnsite.visit_date === theirOnsite.visit_date) {
    if (myOnsite.time_slot && theirOnsite.time_slot &&
        myOnsite.time_slot === theirOnsite.time_slot) {
      const slot = TIME_SLOT_LABEL[myOnsite.time_slot as TimeSlot]
      return { score: 30, reason: `${venueName} ${slot}同在` }
    }
    return { score: 22, reason: `${venueName} 同日` }
  }

  return { score: 15, reason: `你也在这场` }
}

export function searchRadarRooms(params: {
  currentUser: User
  allRooms: RadarRoom[]
  allUsers: User[]
  /** v0.10：全体在场记录（best-effort，RLS 未开放时为空数组 → 自然降级） */
  allPresences?: VenuePresence[]
  /** v0.10：expo_id → venue_id 映射 */
  expoVenueMap?: Record<string, string>
  /** v0.10：expo_id → 漫展标题映射（用于文案） */
  expoTitleMap?: Record<string, string>
}): RadarRoomCandidate[] {
  const {
    currentUser,
    allRooms,
    allUsers,
    allPresences = [],
    expoVenueMap = {},
    expoTitleMap = {},
  } = params

  // 修复 TDZ：先声明再使用
  const userMap = new Map(allUsers.map(u => [u.id, u]))
  const nowIso = new Date().toISOString()

  // 过滤：进行中、未过期、发起人不是 NG 用户
  // 修复：不再过滤自己发的房间，发起方也应看到自己的房间
  const candidates = allRooms
    .filter(r => r.status === 'active' && r.expires_at > nowIso)
    .filter(r => {
      const initiator = userMap.get(r.initiator_id)
      if (!initiator) return false
      if (initiator.ng_tags && initiator.ng_tags.length > 0) return false
      return true
    })

  const results: RadarRoomCandidate[] = []
  for (const room of candidates) {
    const initiator = userMap.get(room.initiator_id)
    if (!initiator) continue

    const isMine = room.initiator_id === currentUser.id

    const interest = interestScoreV3(currentUser, initiator)
    const intent = intentScoreV3(currentUser, initiator)
    const area = areaScoreV3(currentUser, initiator)
    const identity = identityScoreV3(currentUser, initiator)

    // v0.10（2026-10-03）意图优先权重：
    //   兴趣是不易改动的长期项，意图是临时项。
    //   房间填了意图 → 意图升为主导（45%），兴趣退居兜底（35%）
    //   房间没填意图 → 回到兴趣主导（45%），维持原行为
    const roomHasIntent =
      (room.intent_want?.length || 0) > 0 || (room.intent_provide?.length || 0) > 0

    const base = roomHasIntent
      ? intent * 0.45 + interest.total * 0.35 + area.total * 0.10 + identity * 0.10
      : interest.total * 0.45 + intent * 0.25 + area.total * 0.15 + identity * 0.15

    // v0.10：线下同窗会绑定漫展后，同场同日同时段 → 加分
    const expoBonus = computeExpoBonus({
      room,
      currentUser,
      allPresences,
      expoVenueMap,
      expoTitleMap,
    })

    const total = isMine ? 100 : Math.min(100, Math.round(base + expoBonus.score))

    const reasons: string[] = []
    const matchTags: string[] = []

    if (isMine) {
      reasons.push('我发起的同窗会')
    } else {
      // v0.10：漫展同在优先展示（最能打动人的依据）
      if (expoBonus.reason) {
        reasons.push(expoBonus.reason)
      }
      if (roomHasIntent && intent >= 12) {
        reasons.push(`意图匹配`)
      }
      if (interest.works > 0) {
        matchTags.push(`共同作品 ${interest.works} 部`)
        reasons.push(`兴趣匹配 ${Math.round(interest.total)}%`)
      }
      if (!roomHasIntent && intent >= 15) {
        reasons.push(`意图相近`)
      }
      if (area.city > 0) {
        reasons.push(`同城`)
      }
      if (identity >= 8) {
        reasons.push(`身份接近`)
      }
    }

    results.push({
      room,
      initiator,
      score: total,
      reasons: reasons.slice(0, 3),
      match_tags: matchTags,
    })
  }

  // 按分数倒序（自己的 100 分自然排最前）
  results.sort((a, b) => b.score - a.score)
  return results
}
