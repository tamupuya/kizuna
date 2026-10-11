/**
 * userStore — 用户/身份/认证相关状态
 *
 * 从 kizuna.ts 拆分而来 (2026-08-13 Q9 重构)
 * 负责：users 列表、currentUser、登录/注册/更新、onboarding 状态
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import type { User } from '../lib/mockData'

const UID_KEY = 'kizuna.uid'

function loadUid(): string | null {
  try {
    return localStorage.getItem(UID_KEY)
  } catch {
    return null
  }
}

function persistUid(uid: string | null) {
  try {
    if (uid) {
      localStorage.setItem(UID_KEY, uid)
    } else {
      localStorage.removeItem(UID_KEY)
    }
  } catch (e) {
    console.error('[userStore] persistUid failed:', e)
  }
}

export const useUserStore = defineStore('user', () => {
  // State
  const users = ref<User[]>([])
  const currentUserId = ref<string | null>(loadUid())
  const hasOnboarded = ref<boolean>(
    localStorage.getItem('kizuna.onboarded') === '1'
  )
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 持久化 uid 变化
  watch(currentUserId, (uid) => persistUid(uid))

  // Getters
  const currentUser = computed(() =>
    currentUserId.value ? users.value.find(u => u.id === currentUserId.value) : undefined
  )

  const hasUser = computed(() => currentUserId.value !== null)

  // Actions
  async function fetchUsers() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase.from('users').select('*')
      if (err) {
        error.value = err.message
        console.error('fetchUsers error:', err)
      } else {
        users.value = data || []
      }
    } catch (e: any) {
      console.error('fetchUsers exception:', e)
      error.value = e?.message || 'fetchUsers 失败'
      users.value = []
    }
    loading.value = false
  }

  async function createUser(payload: Omit<User, 'id'>): Promise<User | null> {
    try {
      const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const newUser: User = { id: newId, ...payload } as User
      const { data, error: err } = await supabase
        .from('users').insert(newUser).select().single()
      if (err) {
        console.error('createUser error:', err)
        error.value = err.message
        return null
      }
      users.value = [...users.value, data as User]
      currentUserId.value = data!.id
      hasOnboarded.value = true
      localStorage.setItem('kizuna.onboarded', '1')
      return data as User
    } catch (e: any) {
      console.error('createUser exception:', e)
      error.value = e?.message || String(e)
      return null
    }
  }

  async function updateUser(uid: string, patch: Partial<User>): Promise<boolean> {
    try {
      const { error: err } = await supabase.from('users').update(patch).eq('id', uid)
      if (err) {
        console.error('updateUser error:', err)
        error.value = err.message
        return false
      }
      const idx = users.value.findIndex(u => u.id === uid)
      if (idx >= 0) {
        users.value[idx] = { ...users.value[idx], ...patch } as User
      }
      return true
    } catch (e: any) {
      console.error('updateUser exception:', e)
      error.value = e?.message || String(e)
      return false
    }
  }

  async function ensureUserRowFromAuth(authUid: string, email: string): Promise<User | null> {
    if (users.value.length === 0) await fetchUsers()
    let me = users.value.find(u => u.auth_uid === authUid || u.id === authUid)
    if (me) {
      currentUserId.value = me.id
      return me
    }
    const cn = email.split('@')[0].slice(0, 8)
    const newUser: User = {
      id: authUid,
      cn,
      avatar_url: '',
      bio: '',
      gender: 'private',
      identity_tags: [],
      interest_tags: [],
      activity_area: '',
    }
    return createUser(newUser)
  }

  async function syncCurrentUserFromAuth(authUid: string | null): Promise<boolean> {
    if (!authUid) {
      currentUserId.value = null
      return false
    }
    if (users.value.length === 0) await fetchUsers()
    const me = users.value.find(u => u.auth_uid === authUid || u.id === authUid)
    if (me) {
      currentUserId.value = me.id
      persistUid(me.id)
      hasOnboarded.value = true
      return true
    }
    return false
  }

  function setCurrentUser(uid: string | null) {
    currentUserId.value = uid
    persistUid(uid)
    if (uid) {
      hasOnboarded.value = true
      try { localStorage.setItem('kizuna.onboarded', '1') } catch {}
    }
  }

  function signOut() {
    currentUserId.value = null
  }

  function skipOnboarding() {
    hasOnboarded.value = true
    localStorage.setItem('kizuna.onboarded', '1')
  }

  function getUserById(id: string) {
    return users.value.find(u => u.id === id)
  }

  function getUserByIdLocal(id: string): User | undefined {
    return users.value.find(u => u.id === id)
  }

  async function updateContact(uid: string, contactJson: any): Promise<boolean> {
    return updateUser(uid, { contact: contactJson } as any)
  }

  async function saveQrCodes(uid: string, wechatQrUrl: string | null, alipayQrUrl: string | null): Promise<boolean> {
    const u = users.value.find(x => x.id === uid)
    const existing = (u as any)?.contact || {}
    const newContact = { ...existing, wechat_qr: wechatQrUrl, alipay_qr: alipayQrUrl }
    return updateUser(uid, { contact: newContact } as any)
  }

  return {
    users,
    currentUserId,
    currentUser,
    hasUser,
    hasOnboarded,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    ensureUserRowFromAuth,
    syncCurrentUserFromAuth,
    setCurrentUser,
    signOut,
    skipOnboarding,
    getUserById,
    getUserByIdLocal,
    updateContact,
    saveQrCodes,
  }
})
