/**
 * Matching algorithm — front-end only
 *
 * Compute a 0-100 score between current user and a candidate.
 *
 * Dimensions (total 100):
 *   - Interest overlap (40): Jaccard of interest_tags
 *   - Intent complement (25): how well one's intent_provide matches
 *     the other's intent_want, and vice versa
 *   - Identity common (15): how many identity_tags they share
 *   - Activity area (12): city-tier (8) + region-tier (4)
 *   - MBTI compat (8): 4-letter code distance (0-4 letters)
 *   - IP depth bonus (+0~5): how many shared works (not just categories)
 */

import type { User } from './mockData'

export interface MatchScore {
  total: number
  interest: number
  intent: number
  identity: number
  area: number
  area_city: number
  area_region: number
  mbti: number
  ip_depth: number
  reasons: string[]
}

/** Parse "上海 浦东" → { city: "上海", region: "浦东" } */
function parseArea(area?: string): { city: string; region: string } {
  if (!area) return { city: '', region: '' }
  const parts = area.split(/\s+/).filter(Boolean)
  return {
    city: parts[0] || '',
    region: parts[1] || '',
  }
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 0
  const sa = new Set(a)
  const sb = new Set(b)
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter++
  const uni = sa.size + sb.size - inter
  return uni === 0 ? 0 : inter / uni
}

/** MBTI compatibility: NT/NF/SJ/SP 群组相同 + 字母相似度 */
function mbtiScore(a: string, b: string): { score: number; group: string } {
  if (!a || !b) return { score: 0, group: '' }
  const la = a.toUpperCase()
  const lb = b.toUpperCase()
  if (la.length !== 4 || lb.length !== 4) return { score: 0, group: '' }

  // Group classification: NT = Analyst, NF = Diplomat, SJ = Sentinel, SP = Explorer
  const group = (s: string) => {
    const middle = s.charAt(2)
    if (middle === 'T' && s.charAt(1) === 'N') return 'NT'
    if (middle === 'F' && s.charAt(1) === 'N') return 'NF'
    if (middle === 'S' && s.charAt(2) === 'J') return 'SJ'
    return 'SP'
  }
  const ga = group(la)
  const gb = group(lb)

  if (ga !== gb) return { score: 0, group: ga }

  // Same group → count matching letters
  let same = 0
  for (let i = 0; i < 4; i++) if (la.charAt(i) === lb.charAt(i)) same++

  // 4 same letters = identical (8分), 3 same = 6分, 2 same = 4分, 1 same = 2分
  const score = same === 4 ? 8 : same * 2
  return { score, group: ga }
}

/** Count shared works (item-level), not just categories */
function sharedWorksCount(me: User, other: User): number {
  const myWorks = new Set<string>()
  ;(me.interest_categories || []).forEach(c => c.works.forEach(w => myWorks.add(w)))
  const theirWorks = new Set<string>()
  ;(other.interest_categories || []).forEach(c => c.works.forEach(w => theirWorks.add(w)))
  let shared = 0
  for (const w of myWorks) if (theirWorks.has(w)) shared++
  return shared
}

export function scoreMatch(me: User, other: User): MatchScore {
  // 1. Interest (40) — category-level Jaccard
  const interest = Math.round(jaccard(me.interest_tags || [], other.interest_tags || []) * 40)

  // 2. Intent complement (25)
  const iProvide = new Set(me.intent_provide || [])
  const youWant = new Set(other.intent_want || [])
  const iWant = new Set(me.intent_want || [])
  const youProvide = new Set(other.intent_provide || [])

  let giveYou = 0
  for (const x of iProvide) if (youWant.has(x)) giveYou++
  let youGiveMe = 0
  for (const x of youProvide) if (iWant.has(x)) youGiveMe++

  const intentTotal = iWant.size + youWant.size
  const intent = intentTotal === 0
    ? 0
    : Math.round(((giveYou + youGiveMe) / intentTotal) * 25)

  // 3. Identity (15)
  const identity = Math.round(jaccard(me.identity_tags || [], other.identity_tags || []) * 15)

  // 4. Area — split into city + region (12 total)
  const myArea = parseArea(me.activity_area)
  const theirArea = parseArea(other.activity_area)
  let area_city = 0
  let area_region = 0
  if (myArea.city && theirArea.city) {
    if (myArea.city === theirArea.city) {
      area_city = 8
      if (myArea.region && theirArea.region && myArea.region === theirArea.region) {
        area_region = 4
      }
    }
  }
  const area = area_city + area_region

  // 5. MBTI (8)
  const mbtiResult = mbtiScore((me as any).mbti || '', (other as any).mbti || '')
  const mbti = mbtiResult.score

  // 6. IP depth bonus (+0 to +5)
  const shared = sharedWorksCount(me, other)
  const ip_depth = Math.min(5, shared * 2)

  const total = Math.min(100, interest + intent + identity + area + mbti + ip_depth)

  // Reasons
  const reasons: string[] = []
  if (shared > 0) {
    reasons.push(`共同作品 × ${shared}`)
  }
  if (giveYou > 0) {
    const list = Array.from(youWant).filter(x => iProvide.has(x)).slice(0, 2).join('、')
    if (list) reasons.push(`TA 想 ${list}, 你能提供`)
  }
  if (youGiveMe > 0) {
    const list = Array.from(iWant).filter(x => youProvide.has(x)).slice(0, 2).join('、')
    if (list) reasons.push(`你想 ${list}, TA 能提供`)
  }
  if (mbtiResult.score >= 4 && mbtiResult.group) {
    reasons.push(`MBTI 同群组 ${mbtiResult.group}`)
  }
  if (identity > 0) {
    const sharedIds = (me.identity_tags || []).filter(x => (other.identity_tags || []).includes(x))
    if (sharedIds.length) reasons.push(`同是 ${sharedIds[0]}`)
  }
  if (area_city === 8 && myArea.city) {
    if (area_region === 4) reasons.push(`同城同区: ${myArea.city} ${myArea.region}`)
    else reasons.push(`同城: ${myArea.city}`)
  }

  return { total, interest, intent, identity, area, area_city, area_region, mbti, ip_depth, reasons }
}

/**
 * Rank candidates by match score, descending.
 */
export function findMatches(
  me: User,
  candidates: User[],
  excludeIds: string[] = [],
  limit = 10,
): Array<{ user: User; score: MatchScore }> {
  return candidates
    .filter(c => c.id !== me.id && !excludeIds.includes(c.id))
    .map(c => ({ user: c, score: scoreMatch(me, c) }))
    .filter(r => r.score.total > 0)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit)
}