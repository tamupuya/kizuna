/**
 * radarStore — 雷达房间/消息状态
 *
 * 从 kizuna.ts 拆分而来 (2026-08-13 Q9 重构)
 * 负责：radarRooms、radarRoomMessages、closeRadarRoom
 *
 * Q1 隐私修复（2026-08-13）：
 * - 房主解散时不立即删除消息，进入 60s 宽限期
 * - 宽限期内房主可截图/举报
 * - 超时后物理删除
 *
 * v0.10 修复（2026-10-03）：
 * - 【原缺陷】仅靠 setTimeout 删除，切后台/杀进程时定时器不执行
 *   → 房间与消息永久残留，恰好违背 Q1 隐私修复的本意
 *   → 现改为「setTimeout 即时清理 + fetch 时惰性兜底清理」双保险
 * - 【原缺陷】参与者退出只打 log，不从 participants 摘除 → 数组只增不减
 *   → 现由 removeParticipant 摘除并同步远程
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { RadarRoom, RadarRoomMessage } from '../lib/mockData'

/** 房主解散后的宽限期（ms）：期间保留消息供房主截图/举报 */
const CLOSE_GRACE_MS = 60_000

/**
 * 判断房间是否已可物理删除
 * - active 且已过期 → 可删
 * - closed 且过了宽限期 → 可删（closed_at 缺失的老数据直接视为可删）
 */
function isPurgeable(r: RadarRoom, nowMs: number): boolean {
  if (r.status === 'active') {
    return new Date(r.expires_at).getTime() <= nowMs
  }
  const closedAt = r.closed_at ? new Date(r.closed_at).getTime() : 0
  if (!closedAt) return true
  return nowMs - closedAt >= CLOSE_GRACE_MS
}

export const useRadarStore = defineStore('radar', () => {
  const radarRooms = ref<RadarRoom[]>([])
  const radarRoomMessages = ref<RadarRoomMessage[]>([])

  async function fetchRadarRooms() {
    try {
      const { data, error: err } = await supabase.from('radar_rooms').select('*')
      if (err) {
        console.warn('fetchRadarRooms error:', err.message)
        return
      }
      radarRooms.value = (data || []) as RadarRoom[]
      // v0.10：拉取后兜底清理过期/已解散房间（不依赖定时器）
      await purgeStaleRooms()
    } catch (e) {
      console.warn('fetchRadarRooms exception:', e)
    }
  }

  /**
   * 惰性清理：物理删除已过期或已过宽限期的房间
   *
   * 为什么需要它：原来的 setTimeout 在用户切后台/杀进程时不会执行，
   * 房间会永久残留在 Supabase 里。改为每次拉取列表时顺带清理，
   * 只要有人打开 App 就会把陈旧房间回收掉。
   */
  async function purgeStaleRooms(): Promise<void> {
    const nowMs = Date.now()
    const staleIds = radarRooms.value
      .filter(r => isPurgeable(r, nowMs))
      .map(r => r.id)
    if (staleIds.length === 0) return

    // 本地立即移除，避免 UI 再展示
    radarRooms.value = radarRooms.value.filter(r => !staleIds.includes(r.id))
    radarRoomMessages.value = radarRoomMessages.value.filter(m => !staleIds.includes(m.room_id))

    // 远程删除（尽力而为，失败则下次拉取再试）
    try {
      await supabase.from('radar_room_messages').delete().in('room_id', staleIds)
      await supabase.from('radar_rooms').delete().in('id', staleIds)
      console.log(`[radarStore] 已清理 ${staleIds.length} 个过期/已解散房间`)
    } catch (e) {
      console.warn('[radarStore] purgeStaleRooms 远程删除失败（下次重试）:', e)
    }
  }

  /** 本地追加房间（发起成功后立即可见） */
  function addRadarRoom(room: RadarRoom) {
    radarRooms.value = [...radarRooms.value, room]
  }

  /** 添加消息到本地缓存 */
  function addRadarMessage(message: RadarRoomMessage) {
    radarRoomMessages.value = [...radarRoomMessages.value, message]
  }

  /** 获取某个房间的所有消息 */
  function getMessagesByRoom(roomId: string): RadarRoomMessage[] {
    return radarRoomMessages.value
      .filter(m => m.room_id === roomId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  /**
   * 参与者退出：从 participants 摘除并同步远程
   * v0.10 新增：原先退出只打 log，participants 只增不减
   */
  function removeParticipant(roomId: string, uid?: string) {
    if (!uid) return
    const idx = radarRooms.value.findIndex(r => r.id === roomId)
    if (idx < 0) return
    const before = radarRooms.value[idx].participants || []
    if (!before.includes(uid)) return
    const after = before.filter(x => x !== uid)
    radarRooms.value[idx] = { ...radarRooms.value[idx], participants: after }
    supabase
      .from('radar_rooms')
      .update({ participants: after })
      .eq('id', roomId)
      .then(({ error }) => {
        if (error) console.warn('[radarStore] removeParticipant 同步失败:', error.message)
      })
  }

  /**
   * 关闭雷达房间
   * - 参与者退出：从 participants 摘除（房间保留，可再进）
   * - 房主解散：标记 closed + 启动 60s 宽限期，期间保留消息供截图/举报
   *   宽限期结束后物理删除（setTimeout 即时删 + fetch 时惰性兜底）
   */
  async function closeRadarRoom(roomId: string, isInitiator: boolean = false, uid?: string) {
    if (isInitiator) {
      const nowIso = new Date().toISOString()
      console.log(`[radarStore] 房主解散房间 ${roomId}，${CLOSE_GRACE_MS / 1000}s 宽限期后物理删除`)

      // 远程标记 closed（失败不阻塞；惰性清理仍会兜底）
      supabase
        .from('radar_rooms')
        .update({ status: 'closed', closed_at: nowIso })
        .eq('id', roomId)
        .then(({ error }) => {
          if (error) console.warn('[radarStore] 标记 closed 失败（惰性清理会兜底）:', error.message)
        })

      // 本地立即移除（UI 不可见）
      radarRooms.value = radarRooms.value.filter(r => r.id !== roomId)

      // 宽限期后物理删除。若进程被杀导致定时器未执行，
      // 下次 fetchRadarRooms() 的 purgeStaleRooms() 会兜底回收。
      setTimeout(() => {
        void forceDeleteRoom(roomId)
      }, CLOSE_GRACE_MS)
    } else {
      // 参与者退出：仅本地摘除，房间保留
      console.log(`[radarStore] 参与者退出房间 ${roomId}，房间保留`)
      removeParticipant(roomId, uid)
    }
  }

  /** 立即物理删除（举报处理/管理员操作/宽限期到期时调用） */
  async function forceDeleteRoom(roomId: string) {
    try {
      await supabase.from('radar_room_messages').delete().eq('room_id', roomId)
      await supabase.from('radar_rooms').delete().eq('id', roomId)
      console.log(`[radarStore] 房间 ${roomId} 已物理删除`)
    } catch (e) {
      console.warn('forceDeleteRoom failed:', e)
    }
    radarRooms.value = radarRooms.value.filter(r => r.id !== roomId)
    radarRoomMessages.value = radarRoomMessages.value.filter(m => m.room_id !== roomId)
  }

  return {
    radarRooms,
    radarRoomMessages,
    fetchRadarRooms,
    purgeStaleRooms,
    addRadarRoom,
    addRadarMessage,
    getMessagesByRoom,
    removeParticipant,
    closeRadarRoom,
    forceDeleteRoom,
  }
})
