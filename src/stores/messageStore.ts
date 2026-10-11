/**
 * messageStore — 对话/请求/通知状态
 *
 * 从 kizuna.ts 拆分而来 (2026-08-13 Q9 重构)
 * 负责：requests、messages、Realtime 订阅
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export interface Request {
  id: string
  listing_id: string
  requester_id: string
  owner_id: string
  message: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  created_at: string
  conversation_id?: string | null
  listing?: { title: string } | null
  requester?: { cn: string; avatar_url: string; identity_tags?: string[]; activity_area?: string } | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  receiver_id: string
  body: string
  created_at: string
  read_at: string | null
  scope?: 'temporary' | 'persistent'
  scope_id?: string | null
}

export const useMessageStore = defineStore('message', () => {
  const requests = ref<Request[]>([])
  const error = ref<string | null>(null)

  // Getters
  const pendingIncomingCount = computed(() =>
    requests.value.filter(r => r.status === 'pending').length
  )

  const unreadCount = computed(() => {
    const now = Date.now()
    const oneDay = 24 * 3600 * 1000
    let n = 0
    for (const r of requests.value) {
      if (r.status === 'pending') n++
      else if (r.status === 'accepted') {
        const t = new Date(r.created_at).getTime()
        if (now - t < oneDay) n++
      }
    }
    return n
  })

  // Actions
  async function fetchRequests(currentUserId: string) {
    if (!currentUserId) { requests.value = []; return }
    const { data, error: err } = await supabase
      .from('zhonggu_requests')
      .select(`
        *,
        listing:zhonggu_listings(title),
        requester:users!requester_id(cn, avatar_url, identity_tags, activity_area)
      `)
      .or(`owner_id.eq.${currentUserId},requester_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })
    if (err) {
      console.warn('fetchRequests:', err.message)
      requests.value = []
    } else {
      requests.value = (data || []) as Request[]
    }
  }

  async function fetchMessages(conversationId: string) {
    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (err) {
      console.warn('fetchMessages:', err.message)
      return []
    }
    return data || []
  }

  async function createRequest(
    currentUserId: string,
    targetUserId: string,
    message: string,
    listingId?: string,
  ): Promise<Request | null> {
    if (!currentUserId || currentUserId === targetUserId) return null

    let finalListingId = listingId
    if (!finalListingId) {
      finalListingId = 'default'
    }

    const { data, error: err } = await supabase
      .from('zhonggu_requests')
      .insert({
        listing_id: finalListingId,
        requester_id: currentUserId,
        owner_id: targetUserId,
        message: message.slice(0, 200),
        status: 'pending',
      })
      .select(`
        *,
        listing:zhonggu_listings(title),
        requester:users!requester_id(cn, avatar_url)
      `)
      .single()
    if (err) {
      console.error('createRequest:', err)
      error.value = err.message
      return null
    }
    if (data) requests.value.unshift(data as Request)
    return (data as Request) || null
  }

  async function acceptRequest(requestId: string): Promise<boolean> {
    const req = requests.value.find(r => r.id === requestId)
    if (!req) return false
    const conversationId = crypto.randomUUID?.() || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const { error: err } = await supabase
      .from('zhonggu_requests')
      .update({ status: 'accepted', conversation_id: conversationId })
      .eq('id', requestId)
    if (err) { error.value = err.message; return false }
    req.status = 'accepted'
    req.conversation_id = conversationId
    return true
  }

  async function declineRequest(requestId: string): Promise<boolean> {
    const req = requests.value.find(r => r.id === requestId)
    if (!req) return false
    const { error: err } = await supabase
      .from('zhonggu_requests').update({ status: 'declined' }).eq('id', requestId)
    if (err) { error.value = err.message; return false }
    req.status = 'declined'
    return true
  }

  async function sendMessage(
    conversationId: string,
    body: string,
    currentUserId: string,
  ): Promise<{ id?: string; created_at?: string } | null> {
    if (!currentUserId) return null
    const trimmed = body.trim()
    if (!trimmed) return null
    const receiverId = await getReceiverFromConversation(conversationId, currentUserId)
    if (!receiverId) return null
    const optimisticId = crypto.randomUUID?.() || `temp-${Date.now()}`
    const optimisticCreated = new Date().toISOString()
    const { data, error: err } = await supabase
      .from('messages')
      .insert({
        id: optimisticId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        receiver_id: receiverId,
        body: trimmed,
      })
      .select().single()
    if (err) { error.value = err.message; return null }
    return (data as any) || { id: optimisticId, created_at: optimisticCreated }
  }

  async function getReceiverFromConversation(conversationId: string, currentUserId: string): Promise<string | null> {
    const req = requests.value.find(r => r.conversation_id === conversationId)
    if (!req) return null
    return req.owner_id === currentUserId ? req.requester_id : req.owner_id
  }

  // ========= Realtime 订阅 =========
  let messagesChannel: any = null
  let requestsChannel: any = null
  let exposChannel: any = null
  let radarRoomChannel: any = null
  let isSubscribed = false

  async function subscribeRealtime(currentUserId: string) {
    if (isSubscribed || !currentUserId) return
    isSubscribed = true

    messagesChannel = supabase
      .channel(`messages:${currentUserId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload: any) => {
          const m = payload.new
          if (m.sender_id !== currentUserId && m.receiver_id !== currentUserId) return
          window.dispatchEvent(new CustomEvent('kizuna:new-message', { detail: m }))
        })
      .subscribe()

    requestsChannel = supabase
      .channel(`requests:${currentUserId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'zhonggu_requests' },
        async (payload: any) => {
          const r = payload.new
          if (r.owner_id !== currentUserId) return
          await fetchRequests(currentUserId)
          window.dispatchEvent(new CustomEvent('kizuna:new-request', { detail: r }))
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'zhonggu_requests' },
        async (payload: any) => {
          const r = payload.new
          if (r.requester_id !== currentUserId && r.owner_id !== currentUserId) return
          await fetchRequests(currentUserId)
          window.dispatchEvent(new CustomEvent('kizuna:request-updated', { detail: { req: r } }))
        })
      .subscribe()

    exposChannel = supabase
      .channel('expos:global')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'expos' },
        async (payload: any) => {
          await (await import('./expoStore')).useExpoStore().fetchExpos()
          window.dispatchEvent(new CustomEvent('kizuna:expos-changed', {
            detail: { event: payload.eventType, expo: payload.new || payload.old }
          }))
        })
      .subscribe()

    radarRoomChannel = supabase
      .channel('radar-room-messages:global')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'radar_room_messages' },
        async (payload: any) => {
          const m = payload.new
          window.dispatchEvent(new CustomEvent('kizuna:new-radar-message', { detail: m }))
        })
      .subscribe()
  }

  function unsubscribeRealtime() {
    if (messagesChannel) { supabase.removeChannel(messagesChannel); messagesChannel = null }
    if (requestsChannel) { supabase.removeChannel(requestsChannel); requestsChannel = null }
    if (exposChannel) { supabase.removeChannel(exposChannel); exposChannel = null }
    if (radarRoomChannel) { supabase.removeChannel(radarRoomChannel); radarRoomChannel = null }
    isSubscribed = false
  }

  return {
    requests,
    pendingIncomingCount,
    unreadCount,
    error,
    fetchRequests,
    fetchMessages,
    createRequest,
    acceptRequest,
    declineRequest,
    sendMessage,
    subscribeRealtime,
    unsubscribeRealtime,
  }
})
