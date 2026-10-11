// v3 venue 通用场地 + 想去/在场状态管理
// 2026-08-09: P0-A 雷达精进

import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Expo, Venue } from './mockData'

export type VenuePresenceStatus = 'wishlist' | 'onsite' | 'visited' | 'cancelled'

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'all_day'

export interface VenuePresence {
  user_id: string
  venue_id: string
  status: VenuePresenceStatus
  visit_date?: string | null  // YYYY-MM-DD
  time_slot?: TimeSlot | null
  session_start?: string | null  // ISO timestamp（桌游/剧本杀专用）
  created_at?: string
}

// 想去上限
export const WISHLIST_LIMIT = 10

export const TIME_SLOT_LABEL: Record<TimeSlot, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
  all_day: '全天',
}

// store
const myPresences = ref<VenuePresence[]>([])
// v0.10 加入（2026-10-03）：全体用户的在场记录，供同窗会「同漫展 + 同时段」匹配用
// 注意：与 myPresences 不同，这是 best-effort —— RLS 不允许读全表时保持空数组，
// 匹配会自然降级（不加同场分），不影响其他维度
const allPresences = ref<VenuePresence[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export const useVenuePresence = () => {
  async function loadMyPresences(userId: string) {
    if (!isSupabaseConfigured() || !userId) {
      // mock fallback
      myPresences.value = loadFromLocal(userId)
      return
    }
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('venue_presence')
        .select('*')
        .eq('user_id', userId)
      if (err) throw err
      myPresences.value = data || []
      saveToLocal(userId, data || [])
    } catch (e: any) {
      error.value = e?.message || '加载失败'
      myPresences.value = loadFromLocal(userId)
    } finally {
      loading.value = false
    }
  }

  async function setWishlist(userId: string, venueId: string): Promise<boolean> {
    // 检查上限
    const currentWishlist = myPresences.value.filter(
      p => p.user_id === userId && p.status === 'wishlist'
    )
    if (currentWishlist.length >= WISHLIST_LIMIT) {
      error.value = `想去最多 ${WISHLIST_LIMIT} 个`
      return false
    }

    const presence: VenuePresence = {
      user_id: userId,
      venue_id: venueId,
      status: 'wishlist',
      visit_date: null,
      time_slot: null,
      session_start: null,
      created_at: new Date().toISOString(),
    }

    if (!isSupabaseConfigured()) {
      myPresences.value = [...myPresences.value.filter(p => !(p.user_id === userId && p.venue_id === venueId)), presence]
      saveToLocal(userId, myPresences.value)
      return true
    }

    try {
      const { error: err } = await supabase
        .from('venue_presence')
        .upsert(presence, { onConflict: 'user_id,venue_id' })
      if (err) throw err
      await loadMyPresences(userId)
      return true
    } catch (e: any) {
      error.value = e?.message || '想去失败'
      return false
    }
  }

  async function setOnsite(
    userId: string,
    venueId: string,
    visitDate: string,
    timeSlot: TimeSlot
  ): Promise<boolean> {
    const presence: VenuePresence = {
      user_id: userId,
      venue_id: venueId,
      status: 'onsite',
      visit_date: visitDate,
      time_slot: timeSlot,
      session_start: null,
      created_at: new Date().toISOString(),
    }

    if (!isSupabaseConfigured()) {
      myPresences.value = [
        ...myPresences.value.filter(p => !(p.user_id === userId && p.venue_id === venueId)),
        presence,
      ]
      saveToLocal(userId, myPresences.value)
      return true
    }

    try {
      const { error: err } = await supabase
        .from('venue_presence')
        .upsert(presence, { onConflict: 'user_id,venue_id' })
      if (err) throw err
      await loadMyPresences(userId)
      return true
    } catch (e: any) {
      error.value = e?.message || '在场确认失败'
      return false
    }
  }

  async function cancel(userId: string, venueId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      myPresences.value = myPresences.value.filter(
        p => !(p.user_id === userId && p.venue_id === venueId)
      )
      saveToLocal(userId, myPresences.value)
      return true
    }

    try {
      const { error: err } = await supabase
        .from('venue_presence')
        .delete()
        .eq('user_id', userId)
        .eq('venue_id', venueId)
      if (err) throw err
      await loadMyPresences(userId)
      return true
    } catch (e: any) {
      error.value = e?.message || '取消失败'
      return false
    }
  }

  function getPresence(userId: string, venueId: string): VenuePresence | undefined {
    return myPresences.value.find(
      p => p.user_id === userId && p.venue_id === venueId
    )
  }

  /**
   * 拉取全体用户的在场记录（best-effort）
   *
   * 用途：同窗会「同漫展 + 同时段」加分需要对比双方的 presence。
   * 失败处理：RLS 未开放读、网络异常等一律静默降级为空数组，
   * 匹配逻辑会自然跳过同场加分（等于回到旧行为），不阻断主流程。
   */
  async function fetchAllPresences(): Promise<VenuePresence[]> {
    if (!isSupabaseConfigured()) return []
    try {
      const { data, error: err } = await supabase
        .from('venue_presence')
        .select('*')
      if (err) {
        console.warn('[venue] fetchAllPresences 降级（可能是 RLS 未开放读）:', err.message)
        return []
      }
      allPresences.value = data || []
      return allPresences.value
    } catch (e) {
      console.warn('[venue] fetchAllPresences 异常，降级:', e)
      return []
    }
  }

  return {
    presences: computed(() => myPresences.value),
    allPresences: computed(() => allPresences.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    loadMyPresences,
    fetchAllPresences,
    setWishlist,
    setOnsite,
    cancel,
    getPresence,
  }
}

// localStorage fallback
function storageKey(userId: string) {
  return `kizuna.venue_presence.${userId}`
}

function saveToLocal(userId: string, list: VenuePresence[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list))
  } catch (e) {
    // quota exceeded or private mode
  }
}

function loadFromLocal(userId: string): VenuePresence[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}