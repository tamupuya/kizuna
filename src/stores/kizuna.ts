/**
 * kizuna.ts — 聚合 store（向后兼容）
 *
 * 2026-08-13 Q9 重构：拆分为 userStore / listingStore / radarStore / expoStore / messageStore
 * 本文件保留 useKizunaStore 名称，内部代理到子 store
 * 所有现有 import 'kizuna' 不需要修改
 */

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useUserStore } from './userStore'
import { useListingStore } from './listingStore'
import { useRadarStore } from './radarStore'
import { useExpoStore } from './expoStore'
import { useMessageStore, type Request, type Message } from './messageStore'
import { useFollowStore } from './followStore'
import type { User, Expo, Venue, ZhongguListing, Dispute, RadarRoom, RadarRoomMessage } from '../lib/mockData'
import type { Follow } from '../lib/mockData'
import type { ZhongguEvent } from '../lib/zhongguMachine'

// Re-export types for backward compatibility
export type { Request, Message }

export const useKizunaStore = defineStore('kizuna', () => {
  const userStore = useUserStore()
  const listingStore = useListingStore()
  const radarStore = useRadarStore()
  const expoStore = useExpoStore()
  const messageStore = useMessageStore()
  const followStore = useFollowStore()

  // ========= State (proxies) =========
  const users = computed(() => userStore.users)
  const currentUserId = computed(() => userStore.currentUserId)
  const currentUser = computed(() => userStore.currentUser)
  const hasUser = computed(() => userStore.hasUser)
  const hasOnboarded = computed(() => userStore.hasOnboarded)
  const loading = computed(() => userStore.loading)
  const error = computed(() => userStore.error)

  const expos = computed(() => expoStore.expos)
  const venues = computed(() => expoStore.venues)
  // v0.9.23.4：漫展网络状态透传
  const expoOnline = computed(() => expoStore.isOnline)
  const expoStale = computed(() => expoStore.isStale)
  const expoLoading = computed(() => expoStore.loading)

  const listings = computed(() => listingStore.listings)
  const activeListings = computed(() => listingStore.activeListings)
  const myListings = computed(() =>
    listingStore.listings.filter(l => l.owner_id === userStore.currentUserId)
  )

  // 2026-10-03：广场列表 —— 排除自己挂出的商品
  // 自己的挂出只在「中谷店 → 关注」tab 可见，其他任何位置都不可见
  const publicListings = computed(() =>
    listingStore.activeListings.filter(l => l.owner_id !== userStore.currentUserId)
  )

  const radarRooms = computed(() => radarStore.radarRooms)
  const radarRoomMessages = computed(() => radarStore.radarRoomMessages)

  const requests = computed(() => messageStore.requests)
  const myRequests = computed(() =>
    messageStore.requests.filter(
      r => r.owner_id === userStore.currentUserId || r.requester_id === userStore.currentUserId,
    )
  )
  const pendingIncomingCount = computed(() => messageStore.pendingIncomingCount)
  const unreadCount = computed(() => messageStore.unreadCount)

  // 2026-08-21 v0.9.21 follows
  const follows = computed(() => followStore.follows)
  const myFollowingIds = computed(() => followStore.myFollowingIds)
  const myFollowerIds = computed(() => followStore.myFollowerIds)
  const followingCount = computed(() => followStore.followingCount)
  const followerCount = computed(() => followStore.followerCount)
  async function fetchFollows() { return followStore.fetchFollows() }
  async function toggleFollow(followeeId: string) {
    if (!userStore.currentUserId) return false
    return followStore.toggleFollow(followeeId, userStore.currentUserId)
  }
  function isFollowing(followeeId: string) {
    if (!userStore.currentUserId) return false
    return followStore.isFollowing(followeeId, userStore.currentUserId)
  }

  // ========= Actions (proxy) =========
  async function fetchUsers() { return userStore.fetchUsers() }
  async function fetchExpos() { return expoStore.fetchExpos() }
  async function fetchVenues() { return expoStore.fetchVenues() }
  async function fetchListings() { return listingStore.fetchListings() }
  async function fetchRadarRooms() { return radarStore.fetchRadarRooms() }
  function addRadarRoom(room: RadarRoom) { return radarStore.addRadarRoom(room) }
  function addRadarMessage(message: RadarRoomMessage) { return radarStore.addRadarMessage(message) }
  function getMessagesByRoom(roomId: string) { return radarStore.getMessagesByRoom(roomId) }
  async function fetchRequests() {
    if (userStore.currentUserId) return messageStore.fetchRequests(userStore.currentUserId)
  }
  async function fetchMessages(cid: string) { return messageStore.fetchMessages(cid) }
  async function fetchListing(id: string) { return listingStore.fetchListing(id) }

  async function closeRadarRoom(roomId: string, isInitiator?: boolean) {
    return radarStore.closeRadarRoom(roomId, isInitiator)
  }

  function getUserByIdLocal(id: string) { return userStore.getUserByIdLocal(id) }
  function getUserById(id: string) { return userStore.getUserById(id) }
  function getVenueById(id: string) { return expoStore.getVenueById(id) }
  function getExpoById(id: string) { return expoStore.getExpoById(id) }

  // Listing actions (pass currentUserId)
  function transitionListing(listingId: string, event: ZhongguEvent) {
    return listingStore.transitionListing(listingId, event)
  }
  async function reserveListing(listingId: string) {
    return listingStore.reserveListing(listingId, userStore.currentUserId!)
  }
  async function shipListing(listingId: string, trackingNo: string) {
    return listingStore.shipListing(listingId, userStore.currentUserId!, trackingNo)
  }
  async function confirmReceipt(listingId: string) {
    return listingStore.confirmReceipt(listingId, userStore.currentUserId!)
  }
  async function cancelReservation(listingId: string) {
    return listingStore.cancelReservation(listingId, userStore.currentUserId!)
  }
  async function openDispute(
    listingId: string,
    reason: 'not_received' | 'mismatch' | 'defect' | 'other',
    description: string,
    evidenceUrls: string[],
  ) {
    return listingStore.openDispute(listingId, userStore.currentUserId!, reason, description, evidenceUrls)
  }
  async function createListing(
    payload: Omit<ZhongguListing, 'id' | 'owner_id' | 'status' | 'reserved_by' | 'reserved_at' | 'tracking_no' | 'shipped_at' | 'completed_at'>,
  ) {
    return listingStore.createListing(payload, userStore.currentUserId!)
  }
  async function archiveListing(id: string) { return listingStore.archiveListing(id) }
  async function restoreListing(id: string) { return listingStore.restoreListing(id) }
  async function deleteListing(id: string) { return listingStore.deleteListing(id) }

  // Request/Message actions
  async function createRequest(targetUserId: string, message: string, listingId?: string) {
    return messageStore.createRequest(userStore.currentUserId!, targetUserId, message, listingId)
  }
  async function acceptRequest(requestId: string) { return messageStore.acceptRequest(requestId) }
  async function declineRequest(requestId: string) { return messageStore.declineRequest(requestId) }
  async function sendMessage(conversationId: string, body: string) {
    return messageStore.sendMessage(conversationId, body, userStore.currentUserId!)
  }

  // User actions
  async function createUser(payload: Omit<User, 'id'>) { return userStore.createUser(payload) }
  async function updateUser(uid: string, patch: Partial<User>) { return userStore.updateUser(uid, patch) }
  async function ensureUserRowFromAuth(authUid: string, email: string) {
    return userStore.ensureUserRowFromAuth(authUid, email)
  }
  async function syncCurrentUserFromAuth(authUid: string | null) {
    return userStore.syncCurrentUserFromAuth(authUid)
  }
  function setCurrentUser(uid: string | null) { return userStore.setCurrentUser(uid) }
  function signOut() { return userStore.signOut() }
  function skipOnboarding() { return userStore.skipOnboarding() }
  async function updateContact(uid: string, contactJson: any) {
    return userStore.updateContact(uid, contactJson)
  }
  async function saveQrCodes(uid: string, wechatQrUrl: string | null, alipayQrUrl: string | null) {
    return userStore.saveQrCodes(uid, wechatQrUrl, alipayQrUrl)
  }

  // Realtime
  async function subscribeRealtime() {
    return messageStore.subscribeRealtime(userStore.currentUserId!)
  }
  function unsubscribeRealtime() { return messageStore.unsubscribeRealtime() }

  // Init
  async function init() {
    await Promise.all([
      fetchUsers(),
      fetchExpos(),
      fetchVenues(),
      fetchListings(),
    ])
    if (currentUserId.value) {
      await fetchRequests()
    }
  }

  return {
    // State
    users, currentUserId, currentUser, hasUser, hasOnboarded, loading, error,
    expos, venues, expoOnline, expoStale, expoLoading, listings, activeListings, myListings, publicListings,
    radarRooms, radarRoomMessages,
    requests, myRequests, pendingIncomingCount, unreadCount,
    follows, myFollowingIds, myFollowerIds, followingCount, followerCount,
    fetchFollows, toggleFollow, isFollowing,
    // Actions
    fetchUsers, fetchExpos, fetchVenues, fetchListings, fetchRadarRooms,
    addRadarRoom, addRadarMessage, getMessagesByRoom,
    fetchRequests, fetchMessages, fetchListing,
    closeRadarRoom,
    transitionListing,
    reserveListing, shipListing, confirmReceipt, cancelReservation,
    openDispute, createListing, archiveListing, restoreListing, deleteListing,
    createRequest, acceptRequest, declineRequest, sendMessage,
    createUser, updateUser, ensureUserRowFromAuth, syncCurrentUserFromAuth,
    setCurrentUser, signOut, skipOnboarding, updateContact, saveQrCodes,
    subscribeRealtime, unsubscribeRealtime,
    getUserByIdLocal, getUserById, getVenueById, getExpoById,
    init,
  }
})
