import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  const user = computed(() => session.value?.user ?? null)
  const isLoggedIn = computed(() => !!user.value)
  const authUid = computed(() => user.value?.id ?? null)

  let unsubscribe: (() => void) | null = null

  async function init() {
    if (initialized.value) return
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
    } catch (e) {
      console.error('[auth] init failed:', e)
    }
    initialized.value = true
    try {
      if (unsubscribe) unsubscribe()
      const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
        session.value = newSession
      })
      unsubscribe = data.subscription.unsubscribe
    } catch (e) {
      console.error('[auth] onAuthStateChange failed:', e)
    }
  }

  async function signUp(email: string, password: string) {
    if (!isSupabaseConfigured()) { error.value = '未配置'; return null }
    const e = email.trim()
    if (!e || !e.includes('@')) { error.value = '请输入有效邮箱'; return null }
    if (!password || password.length < 6) { error.value = '密码至少 6 位'; return null }
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: window.location.origin },
      })
      loading.value = false
      if (err) { error.value = err.message; return null }
      return data.session ?? null
    } catch (e: any) {
      loading.value = false
      error.value = e?.message || '注册失败'
      return null
    }
  }

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured()) { error.value = '未配置'; return null }
    const e = email.trim()
    if (!e || !e.includes('@')) { error.value = '请输入有效邮箱'; return null }
    if (!password) { error.value = '请输入密码'; return null }
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      })
      loading.value = false
      if (err) { error.value = err.message; return null }
      return data.session
    } catch (e: any) {
      loading.value = false
      error.value = e?.message || '登录失败'
      return null
    }
  }

  async function signOut() {
    try { await supabase.auth.signOut() } catch (e) { console.error('[auth] signOut:', e) }
    session.value = null
  }

  return { session, user, isLoggedIn, authUid, initialized, loading, error, init, signUp, signIn, signOut }
})
