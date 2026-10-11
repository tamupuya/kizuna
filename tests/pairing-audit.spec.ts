/**
 * pairing-audit.spec.ts — 对抗性审查（2026-10-04）
 *
 * 目的：不是「再跑一遍已有测试」，而是**用设计承诺反查代码**。
 *
 * 每条用例都对应一条写在 pairing.ts 顶部注释里的【承诺】。
 * 若代码没做到，用例必须失败 —— 失败即为审查发现。
 *
 * 审查重点：承诺与实现之间的落差，而不是代码能不能编译。
 */

import { describe, it, expect } from 'vitest'
import {
  pickBestMatch,
  countOpenSignals,
  isMutual,
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

// ============================================================
// 审查点 A：双重确认是不是真的「双方」
//
// 承诺（pairing.ts 顶部 + PAIR_LAYERS 注释）：
//   「第一道 = 我愿意让这个人看到我」
//   「双方都愿意，才开始聊」（PairView 模板原文）
//
// 若一方点「愿意认识」就直接进入 matched（显示「你们看见了彼此」），
// 那另一方的同意从未发生 —— UI 在宣称一件没发生的事。
// 这与用户深恶痛绝的「在场确认」谎言属于同一类错误。
// ============================================================

describe('审查点 A：配对必须是双向确认', () => {
  it('只有我单方接受 → 不构成 mutual', () => {
    const decisions: PairDecision[] = [
      { decider_id: 'me', target_id: 'other', decision: 'accept' },
    ]
    expect(isMutual(decisions, 'me', 'other')).toBe(false)
  })

  it('双方都接受 → 构成 mutual', () => {
    const decisions: PairDecision[] = [
      { decider_id: 'me', target_id: 'other', decision: 'accept' },
      { decider_id: 'other', target_id: 'me', decision: 'accept' },
    ]
    expect(isMutual(decisions, 'me', 'other')).toBe(true)
  })

  it('对方接受了我、但我还没接受 → 不构成 mutual（我仍可有自己的判断）', () => {
    const decisions: PairDecision[] = [
      { decider_id: 'other', target_id: 'me', decision: 'accept' },
    ]
    expect(isMutual(decisions, 'me', 'other')).toBe(false)
  })

  it('空决策列表 → 不是 mutual', () => {
    expect(isMutual([], 'me', 'other')).toBe(false)
  })
})

// ============================================================
// 审查点 B：已接受的人不应再次出现在候选里
//
// 承诺：规则③「配对成功不排他」= 可以同时认识【别人】。
// 但「不排他」不等于「同一个人反复出现」。
// 若接受后不作排除，「再看看别人」会一直看到同一个人 —— 产品当场死循环。
// ============================================================

describe('审查点 B：已决定的人不应重复出现', () => {
  it('已接受的人应从候选中排除（否则「再看看别人」死循环）', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [mkSignal('a'), mkSignal('b')],
      users: [mkUser('a'), mkUser('b')],
      excludeUserIds: new Set(['a']),   // a 已接受
    })
    expect(pick?.user.id).toBe('b')
  })

  it('全部都已决定 → 返回 null（而不是重新推同一个人）', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [mkSignal('a')],
      users: [mkUser('a')],
      excludeUserIds: new Set(['a']),
    })
    expect(pick).toBeNull()
  })
})

// ============================================================
// 审查点 C：池子规模不能把自己算进去
//
// 承诺：「显示聚合规模……此刻也在这个场景里的人」
// 我自己的信号也在 pool 里 → 数字虚高 1（显示 3，其实只有 2 个别人）。
// 池子为 0 时的诚实文案也因此失准（明明没人，却显示 1）。
// ============================================================

describe('审查点 C：池子规模应排除自己', () => {
  it('含自己信号时，对外显示的人数应排除自己', () => {
    const sigs = [mkSignal('me'), mkSignal('a'), mkSignal('b')]
    // 对外文案是「此刻也在这个场景里的人」，我算「别人」吗？不算。
    expect(countOpenSignals(sigs, 'me')).toBe(2)
  })

  it('只有自己 → 应显示 0（配合「现在只有你」文案才诚实）', () => {
    expect(countOpenSignals([mkSignal('me')], 'me')).toBe(0)
  })

  it('不传 excludeUserId 时保持旧行为（向后兼容）', () => {
    expect(countOpenSignals([mkSignal('a'), mkSignal('b')])).toBe(2)
  })
})

// ============================================================
// 审查点 D：不排他 ≠ 可以匹配到「已被自己 NG」或「自己」的人
// （回归护栏：确保前面的修复没有被后续改动破坏）
// ============================================================

describe('审查点 D：基础护栏回归', () => {
  it('自己永远不在候选里', () => {
    const me = mkUser('me')
    expect(pickBestMatch({
      me, mySignal: mkSignal('me'),
      signals: [mkSignal('me')], users: [me],
    })).toBeNull()
  })

  it('NG 用户硬过滤', () => {
    expect(pickBestMatch({
      me: mkUser('me'), mySignal: mkSignal('me'),
      signals: [mkSignal('ng')],
      users: [mkUser('ng', { ng_tags: ['雷'] })],
    })).toBeNull()
  })

  it('过期信号不参与匹配', () => {
    expect(pickBestMatch({
      me: mkUser('me'), mySignal: mkSignal('me'),
      signals: [mkSignal('x', { expires_at: new Date(Date.now() - 1).toISOString() })],
      users: [mkUser('x')],
    })).toBeNull()
  })

  it('无交集时仍应给出候选人（算法不做门卫）', () => {
    const pick = pickBestMatch({
      me: mkUser('me'), mySignal: mkSignal('me'),
      signals: [mkSignal('x')], users: [mkUser('x')],
    })
    expect(pick).not.toBeNull()
    expect(pick?.score).toBe(0)
  })
})
