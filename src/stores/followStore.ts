import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Follow } from '../lib/mockData'

/**
 * 2026-08-21 v0.9.21 关注系统 store
 * 关注后可以看到 ta 发布的内容第一时间
 */
export const useFollowStore = defineStore('follow', () => {
  const follows = ref<Follow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // localStorage fallback key
  const LOCAL_KEY = 'kizuna.follows'

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (raw) follows.value = JSON.parse(raw)
    } catch {
      follows.value = []
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(follows.value))
    } catch {}
  }

  async function fetchFollows() {
    if (!isSupabaseConfigured()) {
      loadLocal()
      return
    }
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('follows')
        .select('*')
      if (err) {
        console.warn('[followStore] fetchFollows:', err.message)
        error.value = err.message
        loadLocal()
      } else {
        follows.value = data || []
        saveLocal()
      }
    } catch (e: any) {
      console.warn('[followStore] fetchFollows exception:', e)
      error.value = e?.message || 'fetch failed'
      loadLocal()
    } finally {
      loading.value = false
    }
  }

  async function toggleFollow(followeeId: string, followerId: string) {
    if (!followerId || followerId === followeeId) return false
    const idx = follows.value.findIndex(
      f => f.follower_id === followerId && f.followee_id === followeeId
    )
    if (idx >= 0) {
      // unfollow
      follows.value.splice(idx, 1)
      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('followee_id', followeeId)
        } catch (e) {
          console.warn('[followStore] unfollow failed:', e)
        }
      }
      saveLocal()
      return false
    } else {
      const follow: Follow = {
        follower_id: followerId,
        followee_id: followeeId,
        created_at: new Date().toISOString(),
      }
      follows.value.push(follow)
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('follows').insert(follow)
        } catch (e) {
          console.warn('[followStore] follow failed:', e)
        }
      }
      saveLocal()
      return true
    }
  }

  function isFollowing(followeeId: string, followerId: string): boolean {
    if (!followerId || !followeeId) return false
    return follows.value.some(
      f => f.follower_id === followerId && f.followee_id === followeeId
    )
  }

  /** 我关注的人的 ID 列表 */
  const myFollowingIds = computed(() => {
    return [...new Set(follows.value.map(f => f.followee_id))]
  })

  /** 关注我的人的 ID 列表 */
  const myFollowerIds = computed(() => {
    return [...new Set(follows.value.map(f => f.follower_id))]
  })

  /** 关注数（我关注了 N 人） */
  const followingCount = computed(() => myFollowingIds.value.length)

  /** 粉丝数（N 人关注我） */
  const followerCount = computed(() => myFollowerIds.value.length)

  return {
    follows,
    loading,
    error,
    fetchFollows,
    toggleFollow,
    isFollowing,
    myFollowingIds,
    myFollowerIds,
    followingCount,
    followerCount,
  }
})