import { createMachine } from 'xstate'

/**
 * 中谷店状态机（v0.9.15 起，XState v5）
 *
 * 8 态：active / reserved / shipped / completed / cancelled / disputed / closed / archived
 *
 * 状态转换图：
 *   active ──RESERVE──→ reserved ──SHIP──→ shipped ──COMPLETE──→ completed
 *     │                    │                  │                    │
 *     │                    ├──CANCEL──→ cancelled                  ├──DISPUTE──→ disputed
 *     │                    └──DISPUTE──→ disputed                  └──(final)
 *     │                                  │
 *     ├──CLOSE──→ closed (final)         └──RESOLVE──→ closed (final)
 *     └──ARCHIVE──→ archived ──REACTIVATE──→ active
 *
 * 事件 → 目标状态映射在 eventToTargetStatus() 中（store 用它算 DB patch）
 */

export type ZhongguEvent =
  | { type: 'RESERVE'; reservedBy: string }
  | { type: 'SHIP'; trackingNo: string }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' }
  | { type: 'DISPUTE'; reason: string; description: string; evidence?: string[] }
  | { type: 'RESOLVE'; resolution: 'buyer' | 'seller' | 'platform' }
  | { type: 'CLOSE' }
  | { type: 'ARCHIVE' }
  | { type: 'REACTIVATE' }

export type ZhongguState =
  | 'active'
  | 'reserved'
  | 'shipped'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'closed'
  | 'archived'

/** 事件类型（不含 payload，用于 canTransition 判断） */
export type ZhongguEventType = ZhongguEvent['type']

export const zhongguMachine = createMachine({
  id: 'zhonggu',
  initial: 'active',
  states: {
    active: {
      on: {
        RESERVE: 'reserved',
        CLOSE: 'closed',
        ARCHIVE: 'archived',
      },
    },
    reserved: {
      on: {
        SHIP: 'shipped',
        CANCEL: 'cancelled',
        DISPUTE: 'disputed',
      },
    },
    shipped: {
      on: {
        COMPLETE: 'completed',
        CANCEL: 'cancelled',
        DISPUTE: 'disputed',
      },
    },
    completed: {
      on: {
        DISPUTE: 'disputed',
      },
    },
    cancelled: { type: 'final' },
    disputed: {
      on: {
        RESOLVE: 'closed',
      },
    },
    closed: { type: 'final' },
    archived: {
      on: {
        REACTIVATE: 'active',
      },
    },
  },
})

/**
 * 判断从当前状态能否执行某事件（纯函数）
 */
export function canTransition(currentStatus: string, eventType: ZhongguEventType): boolean {
  const stateNode = (zhongguMachine.states as any)[currentStatus as ZhongguState]
  if (!stateNode) return false
  return !!(stateNode.on && stateNode.on[eventType])
}

/**
 * 获取某状态下所有可执行的事件
 */
export function availableEvents(currentStatus: string): ZhongguEventType[] {
  const stateNode = (zhongguMachine.states as any)[currentStatus as ZhongguState]
  if (!stateNode || !stateNode.on) return []
  return Object.keys(stateNode.on) as ZhongguEventType[]
}

/**
 * 事件类型 → 目标状态映射（store 用它算 DB patch 的 status 值）
 */
export function eventToTargetStatus(eventType: ZhongguEventType): string | null {
  const map: Record<string, string> = {
    RESERVE: 'reserved',
    SHIP: 'shipped',
    COMPLETE: 'completed',
    CANCEL: 'cancelled',
    DISPUTE: 'disputed',
    RESOLVE: 'closed',
    CLOSE: 'closed',
    ARCHIVE: 'archived',
    REACTIVATE: 'active',
  }
  return map[eventType] || null
}
