// 周稳定虚拟 ID 生成
// 2026-08-09: P0-A 雷达精进
// 用户真实 ID 在雷达中不暴露，用虚拟 ID 替代
// 一周内同一用户稳定同一个虚拟 ID，便于记忆但保护隐私

import type { VenuePresence } from './venue'
import { supabase, isSupabaseConfigured } from './supabase'

// ISO 8601 周编号: '2026-W32'
export function getCurrentWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// 6 位虚拟 ID 生成: 从 user_id + week_id hash 出确定性 ID
export function hashVirtualId(userId: string, weekId: string): string {
  const input = `${userId}:${weekId}`
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0  // 32-bit
  }
  // 转 6 位大写字母数字（去掉容易混淆的 0/O/1/I）
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 32 字符
  let id = ''
  let n = Math.abs(hash)
  for (let i = 0; i < 6; i++) {
    id += alphabet[n % alphabet.length]
    n = Math.floor(n / alphabet.length)
    if (n === 0) n = Math.abs(hash) + i + 1  // 避免提前归零
  }
  return id
}

// 异步获取：优先从 virtual_id_cache 查，没有就生成并缓存
export async function getVirtualId(userId: string): Promise<string> {
  const weekId = getCurrentWeekId()
  const fallback = `#${hashVirtualId(userId, weekId)}`

  if (!isSupabaseConfigured() || !userId) {
    return fallback
  }

  try {
    // 1. 查询缓存
    const { data, error: err } = await supabase
      .from('virtual_id_cache')
      .select('virtual_id')
      .eq('user_id', userId)
      .eq('week_id', weekId)
      .maybeSingle()
    if (err) throw err
    if (data?.virtual_id) return `#${data.virtual_id}`

    // 2. 生成新虚拟 ID
    const newId = hashVirtualId(userId, weekId)
    const { error: insertErr } = await supabase
      .from('virtual_id_cache')
      .insert({ user_id: userId, week_id: weekId, virtual_id: newId })
    if (insertErr) {
      // 可能并发冲突，用 fallback
      return fallback
    }
    return `#${newId}`
  } catch (e) {
    return fallback
  }
}

// 本地降级（不依赖 Supabase）
const localCache = new Map<string, string>()
export function getVirtualIdLocal(userId: string): string {
  const weekId = getCurrentWeekId()
  const key = `${userId}:${weekId}`
  if (localCache.has(key)) return `#${localCache.get(key)}`
  const id = hashVirtualId(userId, weekId)
  localCache.set(key, id)
  return `#${id}`
}