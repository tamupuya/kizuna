/**
 * expoStore — 漫展/场地状态
 *
 * 从 kizuna.ts 拆分而来 (2026-08-13 Q9 重构)
 * 负责：expos、venues 列表、查询
 *
 * v0.9.23.4 (2026-08-23)：漫展网络化改造（p0-1）
 * - Supabase 优先：fetchExpos 直接从数据库拉取，不再依赖本地 mock
 * - 离线缓存：成功后写 localStorage，断网时读取缓存
 * - 网络状态：isOnline / isStale / lastSyncedAt，断网 UI 显示红 banner
 * - 重试：fetchExpos({ force: true }) 强制重新拉取
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Expo, Venue } from '../lib/mockData'

const CACHE_KEY = 'kizuna.expos.cache.v1'
const CACHE_KEY_VENUES = 'kizuna.venues.cache.v1'

function readCache<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T[]
  } catch (e) {
    console.warn('readCache failed:', e)
    return null
  }
}

function writeCache<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.warn('writeCache failed:', e)
  }
}

export const useExpoStore = defineStore('expo', () => {
  const expos = ref<Expo[]>([])
  const venues = ref<Venue[]>([])

  // v0.9.23.4：网络状态
  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const isStale = ref(false)      // 显示的是缓存数据（上次同步失败）
  const lastSyncedAt = ref<string | null>(null)
  const loading = ref(false)

  function setOnline(v: boolean) {
    isOnline.value = v
    if (v) {
      // 恢复联网：自动重拉
      fetchExpos()
      fetchVenues()
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
  }

  async function fetchExpos(opts?: { force?: boolean }) {
    loading.value = true
    try {
      // 1. 先读缓存（快速渲染，避免白屏）
      if (!opts?.force && expos.value.length === 0) {
        const cached = readCache<Expo>(CACHE_KEY)
        if (cached && cached.length > 0) {
          expos.value = cached
        }
      }

      // 2. 未配置 Supabase → 保留缓存/mock
      if (!isSupabaseConfigured()) {
        isStale.value = expos.value.length === 0
        return
      }

      // 3. 网络拉取
      const { data, error: err } = await supabase
        .from('expos')
        .select('*')
        .order('start_at', { ascending: true })

      if (err) {
        console.error('fetchExpos error:', err)
        isStale.value = true
        // 失败：回退缓存（已有则不覆盖）
        if (expos.value.length === 0) {
          const cached = readCache<Expo>(CACHE_KEY)
          if (cached && cached.length > 0) expos.value = cached
        }
      } else {
        expos.value = (data as Expo[]) || []
        isStale.value = false
        lastSyncedAt.value = new Date().toISOString()
        writeCache(CACHE_KEY, expos.value)
      }
    } catch (e: any) {
      console.error('fetchExpos exception:', e)
      isStale.value = true
      if (expos.value.length === 0) {
        const cached = readCache<Expo>(CACHE_KEY)
        if (cached && cached.length > 0) expos.value = cached
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchVenues() {
    try {
      if (!isSupabaseConfigured()) {
        const cached = readCache<Venue>(CACHE_KEY_VENUES)
        if (cached) venues.value = cached
        return
      }
      const { data, error: err } = await supabase.from('venues').select('*')
      if (err) {
        console.warn('fetchVenues:', err.message)
        const cached = readCache<Venue>(CACHE_KEY_VENUES)
        if (cached) venues.value = cached
      } else {
        venues.value = (data && data.length > 0) ? (data as Venue[]) : []
        writeCache(CACHE_KEY_VENUES, venues.value)
      }
    } catch (e) {
      console.warn('fetchVenues exception:', e)
      const cached = readCache<Venue>(CACHE_KEY_VENUES)
      if (cached) venues.value = cached
    }
  }

  function getVenueById(id: string) {
    return venues.value.find(v => v.id === id)
  }

  function getExpoById(id: string) {
    return expos.value.find(e => e.id === id)
  }

  return {
    expos,
    venues,
    isOnline,
    isStale,
    lastSyncedAt,
    loading,
    fetchExpos,
    fetchVenues,
    getVenueById,
    getExpoById,
  }
})
