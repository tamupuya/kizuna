/**
 * listingStore — 中谷店二手交易状态
 *
 * 从 kizuna.ts 拆分而来 (2026-08-13 Q9 重构)
 * 负责：zhonggu_listings CRUD、状态机、申诉
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import type { ZhongguListing, Dispute, ListingStatus } from '../lib/mockData'
import { canTransition, eventToTargetStatus, type ZhongguEvent } from '../lib/zhongguMachine'

export const useListingStore = defineStore('listing', () => {
  const listings = ref<ZhongguListing[]>([])
  const error = ref<string | null>(null)

  // Getters
  const activeListings = computed(() =>
    listings.value.filter(l => l.status === 'active')
  )

  // Actions
  async function fetchListings() {
    try {
      const { data, error: err } = await supabase.from('zhonggu_listings').select('*')
      if (err) {
        console.warn('fetchListings:', err.message)
      } else {
        listings.value = data || []
      }
    } catch (e) {
      console.warn('fetchListings exception:', e)
      listings.value = []
    }
  }

  async function fetchListing(id: string): Promise<ZhongguListing | null> {
    const { data, error: err } = await supabase
      .from('zhonggu_listings').select('*').eq('id', id).single()
    if (err) {
      console.warn('fetchListing:', err.message)
      return null
    }
    const idx = listings.value.findIndex(l => l.id === id)
    if (idx >= 0) listings.value[idx] = data as ZhongguListing
    else listings.value.push(data as ZhongguListing)
    return data as ZhongguListing
  }

  async function createListing(
    payload: Omit<ZhongguListing, 'id' | 'owner_id' | 'status' | 'reserved_by' | 'reserved_at' | 'tracking_no' | 'shipped_at' | 'completed_at'>,
    ownerId: string,
  ): Promise<ZhongguListing | null> {
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const newListing: ZhongguListing = {
      id: newId,
      owner_id: ownerId,
      status: 'active',
      reserved_by: null,
      reserved_at: null,
      tracking_no: null,
      shipped_at: null,
      completed_at: null,
      ...payload,
    } as ZhongguListing

    const { data, error: err } = await supabase
      .from('zhonggu_listings').insert(newListing).select().single()
    if (err) {
      console.error('createListing error:', err)
      error.value = err.message
      return null
    }
    listings.value = [...listings.value, data as ZhongguListing]
    return data as ZhongguListing
  }

  /**
   * v0.9.15：统一状态转换函数（XState 驱动）
   * 用 zhongguMachine.canTransition() 判断合法性，调 Supabase 更新 status + 相关字段
   */
  async function transitionListing(
    listingId: string,
    event: ZhongguEvent,
  ): Promise<boolean> {
    const l = listings.value.find(x => x.id === listingId)
    if (!l) return false

    // XState 判断当前状态能否执行此事件
    if (!canTransition(l.status, event.type)) return false

    // 计算目标状态（XState transition 纯函数）
    const targetStatus = eventToTargetStatus(event.type)
    if (!targetStatus) return false
    const patch: Record<string, any> = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    }
    if (event.type === 'RESERVE') {
      patch.reserved_by = (event as any).reservedBy
      patch.reserved_at = new Date().toISOString()
    }
    if (event.type === 'SHIP') {
      patch.tracking_no = (event as any).trackingNo
      patch.shipped_at = new Date().toISOString()
    }
    if (event.type === 'COMPLETE') {
      patch.completed_at = new Date().toISOString()
    }

    const { error: err } = await supabase
      .from('zhonggu_listings')
      .update(patch)
      .eq('id', listingId)

    if (err) {
      console.error(`[transitionListing] ${event.type} error:`, err)
      error.value = err.message
      return false
    }

    // 更新本地
    Object.assign(l, patch)
    return true
  }

  /** 拍下：active → reserved（XState 校验合法性） */
  async function reserveListing(listingId: string, userId: string): Promise<boolean> {
    const l = listings.value.find(x => x.id === listingId)
    if (!l || l.owner_id === userId) return false
    if (!canTransition(l.status, 'RESERVE')) return false
    return transitionListing(listingId, { type: 'RESERVE', reservedBy: userId })
  }

  /** 发货：reserved → shipped */
  async function shipListing(listingId: string, userId: string, trackingNo: string): Promise<boolean> {
    const l = listings.value.find(x => x.id === listingId)
    if (!l || l.owner_id !== userId || !trackingNo.trim()) return false
    if (!canTransition(l.status, 'SHIP')) return false
    return transitionListing(listingId, { type: 'SHIP', trackingNo: trackingNo.trim() })
  }

  /** 确认收货：shipped → completed */
  async function confirmReceipt(listingId: string, userId: string): Promise<boolean> {
    const l = listings.value.find(x => x.id === listingId)
    if (!l || l.reserved_by !== userId) return false
    if (!canTransition(l.status, 'COMPLETE')) return false
    return transitionListing(listingId, { type: 'COMPLETE' })
  }

  /** 取消：reserved / shipped → cancelled */
  async function cancelReservation(listingId: string, userId: string): Promise<boolean> {
    const l = listings.value.find(x => x.id === listingId)
    if (!l) return false
    if (l.reserved_by !== userId && l.owner_id !== userId) return false
    if (!canTransition(l.status, 'CANCEL')) return false
    return transitionListing(listingId, { type: 'CANCEL' })
  }

  /** 发起申诉：reserved / shipped / completed → disputed（XState 校验 + 插 disputes 表） */
  async function openDispute(
    listingId: string,
    userId: string,
    reason: 'not_received' | 'mismatch' | 'defect' | 'other',
    description: string,
    evidenceUrls: string[],
  ): Promise<Dispute | null> {
    const l = listings.value.find(x => x.id === listingId)
    if (!l) return null
    if (!canTransition(l.status, 'DISPUTE')) return null
    if (l.reserved_by !== userId && l.owner_id !== userId) return null

    const { data: dispute, error: e1 } = await supabase
      .from('disputes')
      .insert({
        listing_id: listingId,
        opened_by: userId,
        reason,
        description: description.slice(0, 500),
        evidence: evidenceUrls.map(url => ({ type: 'image', url })),
      })
      .select().single()
    if (e1) { error.value = e1.message; return null }

    await supabase.from('zhonggu_listings').update({ status: 'disputed' }).eq('id', listingId)
    l.status = 'disputed'
    return dispute as Dispute
  }

  async function archiveListing(id: string): Promise<boolean> {
    try {
      const { data, error: e } = await supabase
        .from('zhonggu_listings')
        .update({ status: 'archived', updated_at: new Date().toISOString() } as any)
        .eq('id', id).select().single()
      if (e) throw e
      const idx = listings.value.findIndex(l => l.id === id)
      if (idx >= 0) listings.value[idx] = data as ZhongguListing
      return true
    } catch (err) {
      console.error('archiveListing error:', err)
      return false
    }
  }

  async function restoreListing(id: string): Promise<boolean> {
    try {
      const { data, error: e } = await supabase
        .from('zhonggu_listings')
        .update({ status: 'active', updated_at: new Date().toISOString() } as any)
        .eq('id', id).select().single()
      if (e) throw e
      const idx = listings.value.findIndex(l => l.id === id)
      if (idx >= 0) listings.value[idx] = data as ZhongguListing
      return true
    } catch (err) {
      console.error('restoreListing error:', err)
      return false
    }
  }

  async function deleteListing(id: string): Promise<boolean> {
    try {
      const { error: e } = await supabase.from('zhonggu_listings').delete().eq('id', id)
      if (e) throw e
      listings.value = listings.value.filter(l => l.id !== id)
      return true
    } catch (err) {
      console.error('deleteListing error:', err)
      return false
    }
  }

  return {
    listings,
    activeListings,
    error,
    fetchListings,
    fetchListing,
    createListing,
    transitionListing,
    reserveListing,
    shipListing,
    confirmReceipt,
    cancelReservation,
    openDispute,
    archiveListing,
    restoreListing,
    deleteListing,
  }
})
