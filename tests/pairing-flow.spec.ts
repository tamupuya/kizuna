/**
 * pairing-flow.spec.ts — 端到端流程审查（2026-10-04）
 *
 * 前两个 spec 审的是「单个函数对不对」。
 * 这个 spec 审的是「整条流程走得通吗」—— 用两个用户跑完整的三段式。
 *
 * 因为「配对」这件事的本质是【两个人的互动】，
 * 任何单用户视角的测试都无法证明双向确认真的成立。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  pickBestMatch,
  countOpenSignals,
  isMutual,
  pairKey,
  type PairSignal,
  type PairDecision,
} from '../src/lib/pairing'
import type { User } from '../src/lib/mockData'

function mkUser(id: string, over: Partial<User> = {}): User {
  return {
    id, cn: id, avatar_url: '', bio: '', gender: 'private',
    identity_tags: [], interest_tags: [], ...over,
  } as User
}

function mkSignal(uid: string, over: Partial<PairSignal> = {}): PairSignal {
  return {
    id: `sig-${uid}`, user_id: uid, intent_want: [], intent_provide: [],
    expo_id: null, time_window: 900,
    expires_at: new Date(Date.now() + 900_000).toISOString(),
    status: 'open', created_at: new Date().toISOString(), ...over,
  }
}

/**
 * 模拟「服务器」：存信号与表态
 * 用真实的两张表语义（pair_signals / pair_decisions）
 */
class FakeServer {
  signals: PairSignal[] = []
  decisions: PairDecision[] = []

  /** 客户端读到的表态：受 RLS 限制，只能看到与我有关的 */
  readDecisionsFor(uid: string): PairDecision[] {
    return this.decisions.filter(d => d.decider_id === uid || d.target_id === uid)
  }

  pushSignal(s: PairSignal) {
    this.signals.push(s)
  }

  /** 只写 accept（skip 永不落库 —— 硬约束） */
  decide(deciderId: string, targetId: string, decision: 'accept' | 'skip') {
    if (decision === 'skip') return   // 跳过不落库，这正是「不可见」的实现
    const exists = this.decisions.find(
      d => d.decider_id === deciderId && d.target_id === targetId
    )
    if (!exists) {
      this.decisions.push({ decider_id: deciderId, target_id: targetId, decision: 'accept' })
    }
  }
}

describe('审查点 F：双人完整流程端到端', () => {
  let server: FakeServer
  beforeEach(() => {
    server = new FakeServer()
  })

  it('两个陌生人推窗 → 看到彼此 → 双方愿意 → 配对成立', () => {
    const alice = mkUser('alice', { identity_tags: ['coser'], intent_want: ['逛展'] })
    const bob = mkUser('bob', { identity_tags: ['coser'], intent_provide: ['逛展'] })

    const sigA = mkSignal('alice', { intent_want: ['逛展'] })
    const sigB = mkSignal('bob', { intent_provide: ['逛展'] })
    server.pushSignal(sigA)
    server.pushSignal(sigB)

    // --- 池子规模：Alice 看到「除我之外有 1 人」 ---
    expect(countOpenSignals(server.signals, 'alice')).toBe(1)

    // --- Alice 匹配到 Bob ---
    const pickA = pickBestMatch({
      me: alice, mySignal: sigA,
      signals: server.signals, users: [alice, bob],
      excludeUserIds: new Set(),
    })
    expect(pickA?.user.id).toBe('bob')

    // --- Alice 点「愿意认识」→ 只写入自己的表态 ---
    server.decide('alice', 'bob', 'accept')
    // 此刻【不能】说配对成立：Bob 还没表态
    expect(isMutual(server.readDecisionsFor('alice'), 'alice', 'bob')).toBe(false)

    // --- Bob 也匹配到 Alice 并愿意 ---
    const pickB = pickBestMatch({
      me: bob, mySignal: sigB,
      signals: server.signals, users: [alice, bob],
      excludeUserIds: new Set(),
    })
    expect(pickB?.user.id).toBe('alice')
    server.decide('bob', 'alice', 'accept')

    // --- 现在双方都愿意 → 成立 ---
    expect(isMutual(server.readDecisionsFor('alice'), 'alice', 'bob')).toBe(true)
    expect(isMutual(server.readDecisionsFor('bob'), 'alice', 'bob')).toBe(true)
    // 双方视角必须一致（不能一方以为成了，另一方还不知道）
    expect(pairKey('alice', 'bob')).toBe(pairKey('bob', 'alice'))
  })

  it('一方愿意、另一方跳过 → 不成立，且双方都不知道「被跳过」', () => {
    const alice = mkUser('alice')
    const bob = mkUser('bob')
    server.pushSignal(mkSignal('alice'))
    server.pushSignal(mkSignal('bob'))

    server.decide('alice', 'bob', 'accept')
    server.decide('bob', 'alice', 'skip')   // 跳过 → 不落库

    // 不成立
    expect(isMutual(server.readDecisionsFor('alice'), 'alice', 'bob')).toBe(false)
    // 关键：Alice 查不到「Bob 跳过了我」—— 库里根本没有这条记录
    expect(server.decisions.length).toBe(1)
    expect(server.decisions[0].decider_id).toBe('alice')
    expect(
      server.readDecisionsFor('alice').some(d => d.decision === 'skip')
    ).toBe(false)
  })

  it('接受后再看别人：不得重复推到同一个人', () => {
    const me = mkUser('me')
    const decided = new Set(['a'])
    const pick = pickBestMatch({
      me, mySignal: mkSignal('me'),
      signals: [mkSignal('a'), mkSignal('b'), mkSignal('c')],
      users: [mkUser('a'), mkUser('b'), mkUser('c')],
      excludeUserIds: decided,
    })
    expect(pick).not.toBeNull()
    expect(['b', 'c']).toContain(pick!.user.id)
    expect(pick!.user.id).not.toBe('a')
  })

  it('不排他：可连续接受多个人（漫展扩列语义）', () => {
    const me = mkUser('me')
    const decided = new Set<string>()
    const seen: string[] = []

    for (let i = 0; i < 3; i++) {
      const pick = pickBestMatch({
        me, mySignal: mkSignal('me'),
        signals: [mkSignal('a'), mkSignal('b'), mkSignal('c')],
        users: [mkUser('a'), mkUser('b'), mkUser('c')],
        excludeUserIds: decided,
      })
      if (!pick) break
      decided.add(pick.user.id)
      seen.push(pick.user.id)
    }

    expect(seen.length).toBe(3)                       // 三人全认识到了
    expect(new Set(seen).size).toBe(3)                // 没有重复
    expect(pickBestMatch({
      me, mySignal: mkSignal('me'),
      signals: [mkSignal('a'), mkSignal('b'), mkSignal('c')],
      users: [mkUser('a'), mkUser('b'), mkUser('c')],
      excludeUserIds: decided,
    })).toBeNull()                                    // 都认识完了 → 诚实返回「没有了」
  })

  it('时间窗过期 → 信号自动失效，不参与匹配与计数', () => {
    const me = mkUser('me')
    const expired = mkSignal('x', { expires_at: new Date(Date.now() - 60_000).toISOString() })
    expect(countOpenSignals([expired], 'me')).toBe(0)
    expect(pickBestMatch({
      me, mySignal: mkSignal('me'),
      signals: [expired], users: [mkUser('x')],
    })).toBeNull()
  })
})
