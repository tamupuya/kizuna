/**
 * Matching algorithm v2 (front-end only)
 *
 * 漫展场景优先的同好匹配算法。
 *
 * 总分 = 100:
 *   - Scene 场景 (30): 同场 30 / 同想去 18 / 同城 12 / 其他 0
 *   - Interest 兴趣 (27): 分类交集 × 16 + 作品交集 × 11
 *   - Intent 意图 (20): 双向互补 (give_you × 10 + you_give_me × 10)
 *   - Identity 身份 (15): Jaccard of identity_tags
 *   - Area 地区 (8):  同区 5 / 同市 3 / 同省 1
 *   - (v0.9.10.1 移除 MBTI 维度：不参与匹配，但仍保留展示)
 *
 * 分池推荐（不只排名）:
 *   - onSite: 今天同场漫展的同好（scene = 30）
 *   - upcoming: 同想去的近期展（scene = 18）
 *   - city: 同城同好（scene = 12）
 *   - global: 其他维度高分（scene = 0）
 *
 * Reasons 文案（场景化）:
 *   - "今天 CP30 同在"
 *   - "都想去看 BW2026"
 *   - "共同作品 × N"
 *   - "你想 X，TA 能提供"
 *
 * 2026-07-28
 */

import type { User } from './mockData'

export interface MatchScoreV2 {
  total: number
  scene: number
  interest: number
  interest_category: number
  interest_works: number
  intent: number
  identity: number
  area: number
  area_city: number
  area_region: number
  reasons: string[]
  /** 场景标签: onSite / upcoming / city / global */
  sceneBucket: 'onSite' | 'upcoming' | 'city' | 'global'
}

export interface ScoredMatch {
  user: User
  score: MatchScoreV2
}

export interface SceneBuckets {
  onSite: ScoredMatch[]
  upcoming: ScoredMatch[]
  city: ScoredMatch[]
  global: ScoredMatch[]
}

// ========== 基础工具 ==========

function jaccard(a: string[], b: string[]): number {
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

function mbtiScore(a: string, b: string): { score: number; group: string } {
  if (!a || !b) return { score: 0, group: '' }
  const la = a.toUpperCase()
  const lb = b.toUpperCase()
  if (la.length !== 4 || lb.length !== 4) return { score: 0, group: '' }
  const group = (s: string) => {
    if (s.charAt(1) === 'N' && s.charAt(2) === 'T') return 'NT'
    if (s.charAt(1) === 'N' && s.charAt(2) === 'F') return 'NF'
    if (s.charAt(2) === 'J') return 'SJ'
    return 'SP'
  }
  const ga = group(la)
  const gb = group(lb)
  if (ga !== gb) return { score: 0, group: ga }
  let same = 0
  for (let i = 0; i < 4; i++) if (la.charAt(i) === lb.charAt(i)) same++
  return { score: Math.min(4, same), group: ga }
}

function sharedWorksCount(me: User, other: User): number {
  const myWorks = new Set<string>()
  ;(me.interest_categories || []).forEach(c => c.works.forEach(w => myWorks.add(w)))
  const theirWorks = new Set<string>()
  ;(other.interest_categories || []).forEach(c => c.works.forEach(w => theirWorks.add(w)))
  let shared = 0
  for (const w of myWorks) if (theirWorks.has(w)) shared++
  return shared
}

// ========== 维度打分 ==========

/** Scene: 场景加权（30 分上限） */
function sceneScore(
  me: User,
  other: User,
  expoTitles?: Map<string, string>,
): { score: number; bucket: MatchScoreV2['sceneBucket'] } {
  // 1. 同场
  if (
    me.current_expo_id &&
    other.current_expo_id &&
    me.current_expo_id === other.current_expo_id
  ) {
    // 同场馆额外 +0~5 (这里内嵌进 30 内作为加分点 28~30)
    let bonus = 0
    if (me.current_venue_id && me.current_venue_id === other.current_venue_id) bonus = 2
    return { score: 28 + bonus, bucket: 'onSite' }
  }

  // 2. 同想去的展 (交集不为空)
  const myWants = new Set(me.want_expos || [])
  const theirWants = new Set(other.want_expos || [])
  for (const x of myWants) if (theirWants.has(x)) {
    return { score: 18, bucket: 'upcoming' }
  }

  // 3. 同城
  const myArea = parseArea(me.activity_area)
  const theirArea = parseArea(other.activity_area)
  if (myArea.city && theirArea.city && myArea.city === theirArea.city) {
    return { score: 12, bucket: 'city' }
  }

  // 4. 其他
  return { score: 0, bucket: 'global' }
}

/** Interest: 分类 + 作品（27 分） */
function interestScore(me: User, other: User): { total: number; cat: number; works: number } {
  // 分类交集
  const myCats = (me.interest_categories || []).map(c => c.name)
  const theirCats = (other.interest_categories || []).map(c => c.name)
  const cat = Math.round(jaccard(myCats, theirCats) * 16)

  // 作品交集（按相对密度）
  const shared = sharedWorksCount(me, other)
  const myWorkCount = (me.interest_categories || []).reduce((sum, c) => sum + c.works.length, 0)
  const theirWorkCount = (other.interest_categories || []).reduce((sum, c) => sum + c.works.length, 0)
  const maxWorks = Math.max(6, myWorkCount, theirWorkCount)
  const works = Math.round((shared / maxWorks) * 11)

  return { total: Math.min(27, cat + works), cat, works }
}

/** Intent: 双向互补（20 分） */
function intentScore(me: User, other: User): number {
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

/** Identity: 身份 Jaccard（15 分） */
function identityScore(me: User, other: User): number {
  return Math.round(jaccard(me.identity_tags || [], other.identity_tags || []) * 15)
}

/** Area: 地区（8 分）— 同区 5 / 同市 3 / 同省 1 */
function areaScore(me: User, other: User): { total: number; city: number; region: number } {
  const myArea = parseArea(me.activity_area)
  const theirArea = parseArea(other.activity_area)
  let city = 0
  let region = 0
  if (myArea.city && theirArea.city) {
    if (myArea.city === theirArea.city) {
      city = 3
      if (myArea.region && theirArea.region && myArea.region === theirArea.region) {
        region = 2 // 同区额外 +2（合计 5）
      }
    }
  }
  return { total: city + region, city, region }
}

/** MBTI 不再参与匹配（v0.9.10.1） */
function mbtiTotal(_me: User, _other: User): number {
  return 0
}

// ========== 总分 ==========

export interface ExpoLookup {
  /** expoId -> 标题，用于 reasons 文案 */
  getExpoTitle(id: string): string | undefined
}

export function scoreMatchV2(
  me: User,
  other: User,
  lookup?: ExpoLookup,
): MatchScoreV2 {
  const scene = sceneScore(me, other)
  const interest = interestScore(me, other)
  const intent = intentScore(me, other)
  const identity = identityScore(me, other)
  const area = areaScore(me, other)
  const mbti = mbtiTotal(me, other)

  const total = Math.min(
    100,
    scene.score + interest.total + intent + identity + area.total + mbti,
  )

  // Reasons 文案（场景化）
  const reasons: string[] = []

  // 1. 场景（最强信号，最优先）
  if (scene.bucket === 'onSite' && me.current_expo_id) {
    const title = lookup?.getExpoTitle(me.current_expo_id) || '这个漫展'
    reasons.push(`今天 ${title} 同在`)
  } else if (scene.bucket === 'upcoming' && me.want_expos) {
    const sharedId = me.want_expos.find(x => (other.want_expos || []).includes(x))
    if (sharedId) {
      const title = lookup?.getExpoTitle(sharedId) || '这个展'
      reasons.push(`都想去看 ${title}`)
    }
  } else if (scene.bucket === 'city') {
    const myArea = parseArea(me.activity_area)
    reasons.push(`同城：${myArea.city}`)
  }

  // 2. 共同作品
  const shared = sharedWorksCount(me, other)
  if (shared > 0) {
    reasons.push(`共同作品 × ${shared}`)
  }

  // 3. 互补意图
  const iProvide = new Set(me.intent_provide || [])
  const youWant = new Set(other.intent_want || [])
  const iWant = new Set(me.intent_want || [])
  const youProvide = new Set(other.intent_provide || [])

  let giveYou = 0
  for (const x of iProvide) if (youWant.has(x)) giveYou++
  let youGiveMe = 0
  for (const x of youProvide) if (iWant.has(x)) youGiveMe++

  if (giveYou > 0) {
    const list = Array.from(youWant).filter(x => iProvide.has(x)).slice(0, 2).join('、')
    if (list) reasons.push(`TA 想 ${list}, 你能提供`)
  }
  if (youGiveMe > 0) {
    const list = Array.from(iWant).filter(x => youProvide.has(x)).slice(0, 2).join('、')
    if (list) reasons.push(`你想 ${list}, TA 能提供`)
  }

  // 4. 身份
  if (identity > 0) {
    const sharedIds = (me.identity_tags || []).filter(x => (other.identity_tags || []).includes(x))
    if (sharedIds.length) reasons.push(`同是 ${sharedIds[0]}`)
  }

  // 5. (移除 MBTI 同群组文案 — v0.9.10.1)

  // 6. 同区（兜底）
  if (area.total >= 5) {
    const myArea = parseArea(me.activity_area)
    reasons.push(`同区：${myArea.city} ${myArea.region}`)
  }

  return {
    total,
    scene: scene.score,
    interest: interest.total,
    interest_category: interest.cat,
    interest_works: interest.works,
    intent,
    identity,
    area: area.total,
    area_city: area.city,
    area_region: area.region,
    reasons,
    sceneBucket: scene.bucket,
  }
}

// ========== 分池推荐 ==========

export interface RecommendOptions {
  excludeIds?: string[]
  /** 每个桶的容量上限，默认 3 */
  perBucket?: number
}

export function recommendByScene(
  me: User,
  candidates: User[],
  lookup?: ExpoLookup,
  options: RecommendOptions = {},
): SceneBuckets {
  const { excludeIds = [], perBucket = 3 } = options

  // 1. 全部打分
  const all: ScoredMatch[] = candidates
    .filter(c => c.id !== me.id && !excludeIds.includes(c.id))
    .map(c => ({ user: c, score: scoreMatchV2(me, c, lookup) }))
    .filter(r => r.score.total > 0)

  // 2. 按场景分桶
  const buckets: SceneBuckets = {
    onSite: [],
    upcoming: [],
    city: [],
    global: [],
  }
  for (const r of all) {
    buckets[r.score.sceneBucket].push(r)
  }

  // 3. 桶内排序
  for (const key of Object.keys(buckets) as Array<keyof SceneBuckets>) {
    buckets[key].sort((a, b) => b.score.total - a.score.total)
  }

  // 4. 截取每桶 perBucket
  return {
    onSite:   buckets.onSite.slice(0, perBucket),
    upcoming: buckets.upcoming.slice(0, perBucket),
    city:     buckets.city.slice(0, perBucket),
    global:   buckets.global.slice(0, perBucket),
  }
}

/** 展开为单一排序列表（兼容旧 API） */
export function findMatchesV2(
  me: User,
  candidates: User[],
  lookup?: ExpoLookup,
  excludeIds: string[] = [],
  limit = 10,
): ScoredMatch[] {
  return candidates
    .filter(c => c.id !== me.id && !excludeIds.includes(c.id))
    .map(c => ({ user: c, score: scoreMatchV2(me, c, lookup) }))
    .filter(r => r.score.total > 0)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit)
}