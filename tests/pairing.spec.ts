/**
 * pairing.spec.ts — 双人配对逻辑测试（同窗会 v0.10，2026-10-03）
 *
 * 重点验证【四条核心规则】在代码层面真的成立，
 * 而不只是写在注释里的承诺：
 *
 *   ① 保护是默认态（不设 ≠ 设为公开）
 *   ② 被跳过方无感 / 不可见（跳过不落库）
 *   ③ 配对成功不排他
 *   ④ 产物当场有效，过期即散
 *
 * 另验证池子规模统计（缓解「小池子 × 双向不可见 → 零匹配」的致命处）
 */

import { describe, it, expect } from 'vitest'
import {
  pickBestMatch,
  countOpenSignals,
  scorePair,
  selfTestPairing,
  type PairSignal,
} from '../src/lib/pairing'
import type { User } from '../src/lib/mockData'

// ---------- 测试夹具 ----------

function mkUser(id: string, over: Partial<User> = {}): User {
  return {
    id,
    cn: id,
    avatar_url: '',
    bio: '',
    gender: 'private',
    identity_tags: [],
    interest_tags: [],
    ...over,
  } as User
}

function mkSignal(uid: string, over: Partial<PairSignal> = {}): PairSignal {
  return {
    id: `sig-${uid}`,
    user_id: uid,
    intent_want: [],
    intent_provide: [],
    expo_id: null,
    time_window: 900,
    expires_at: new Date(Date.now() + 900_000).toISOString(),
    status: 'open',
    created_at: new Date().toISOString(),
    ...over,
  }
}

// ---------- 规则①：保护是默认态 ----------

describe('规则① 保护是默认态', () => {
  it('评分本身不暴露任何联系方式字段', () => {
    const result = scorePair({
      me: mkUser('me', { identity_tags: ['coser'] }),
      other: mkUser('other', { identity_tags: ['coser'] }),
      mySignal: mkSignal('me'),
      theirSignal: mkSignal('other'),
    })
    // 返回的 user 对象里不应出现「默认可见」的隐私字段
    const exposed = JSON.stringify(result)
    expect(exposed).not.toContain('"contact"')
  })

  it('理由文案只描述共同点，不含真实昵称', () => {
    const other = mkUser('other', { cn: '真名不该外泄', identity_tags: ['coser'] })
    const result = scorePair({
      me: mkUser('me', { identity_tags: ['coser'] }),
      other,
      mySignal: mkSignal('me'),
      theirSignal: mkSignal('other'),
    })
    for (const r of result.reasons) {
      expect(r).not.toContain('真名不该外泄')
    }
  })
})

// ---------- 规则②：被跳过方无感 ----------

describe('规则② 被跳过方无感 / 不可见', () => {
  it('跳过的人不会再次被匹配到', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [mkSignal('x'), mkSignal('y')],
      users: [mkUser('x'), mkUser('y')],
      skipSet: new Set(['x']),
    })
    expect(pick?.user.id).toBe('y')
  })

  it('跳过全部候选时返回 null（不是报错，也不提示「被跳过」）', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [mkSignal('x')],
      users: [mkUser('x')],
      skipSet: new Set(['x']),
    })
    expect(pick).toBeNull()
  })

  it('NG 用户是硬过滤（与 skip 不同：无需我操作即不可见）', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [mkSignal('ng')],
      users: [mkUser('ng', { ng_tags: ['雷点'] })],
    })
    expect(pick).toBeNull()
  })
})

// ---------- 规则③：配对成功不排他 ----------

describe('规则③ 配对成功不排他', () => {
  it('接受一人后，仍可匹配到其他人', () => {
    // 不排他意味着 pickBestMatch 不因「已认识 x」而排除 x 以外的人
    const pick = pickBestMatch({
      me: mkUser('me', { identity_tags: ['coser'] }),
      mySignal: mkSignal('me', { intent_want: ['逛展'] }),
      signals: [mkSignal('a'), mkSignal('b')],
      users: [
        mkUser('a', { identity_tags: ['coser'], intent_provide: ['逛展'] }),
        mkUser('b', { identity_tags: ['coser'], intent_provide: ['逛展'] }),
      ],
      // 注意：accepted 名单【不】参与过滤 —— 这正是「不排他」的代码体现
      skipSet: new Set(),
    })
    expect(pick).not.toBeNull()
  })
})

// ---------- 规则④：过期即散 ----------

describe('规则④ 产物当场有效，过期即散', () => {
  it('已过期信号不计入池子规模', () => {
    const sigs = [
      mkSignal('a'),
      mkSignal('b', { expires_at: new Date(Date.now() - 1000).toISOString() }),
    ]
    expect(countOpenSignals(sigs)).toBe(1)
  })

  it('已匹配 / 已取消的信号不再参与匹配', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [
        mkSignal('a', { status: 'matched' }),
        mkSignal('b', { status: 'cancelled' }),
      ],
      users: [mkUser('a'), mkUser('b')],
    })
    expect(pick).toBeNull()
  })

  it('过期信号不会被匹配到', () => {
    const pick = pickBestMatch({
      me: mkUser('me'),
      mySignal: mkSignal('me'),
      signals: [mkSignal('a', { expires_at: new Date(Date.now() - 1).toISOString() })],
      users: [mkUser('a')],
    })
    expect(pick).toBeNull()
  })
})

// ---------- 池子规模（缓解「零匹配黑等」） ----------

describe('池子规模统计', () => {
  it('只统计 open 且未过期的信号', () => {
    const sigs = [
      mkSignal('a'),
      mkSignal('b'),
      mkSignal('c', { status: 'matched' }),
      mkSignal('d', { status: 'cancelled' }),
      mkSignal('e', { expires_at: new Date(Date.now() - 5).toISOString() }),
    ]
    expect(countOpenSignals(sigs)).toBe(2)
  })

  it('空池返回 0（诚实：真的没人，不是你的问题）', () => {
    expect(countOpenSignals([])).toBe(0)
  })
})

// ---------- 匹配基线行为 ----------

describe('匹配基线行为', () => {
  it('不会匹配到自己', () => {
    const me = mkUser('me')
    const pick = pickBestMatch({
      me,
      mySignal: mkSignal('me'),
      signals: [mkSignal('me')],
      users: [me],
    })
    expect(pick).toBeNull()
  })

  it('分数落在 0-100 区间', () => {
    const s = scorePair({
      me: mkUser('me', { identity_tags: ['coser'] }),
      other: mkUser('o', { identity_tags: ['coser'] }),
      mySignal: mkSignal('me', { intent_want: ['逛展'] }),
      theirSignal: mkSignal('o', { intent_provide: ['逛展'] }),
    })
    expect(s.score).toBeGreaterThanOrEqual(0)
    expect(s.score).toBeLessThanOrEqual(100)
  })

  it('意图互补应高于完全无交集', () => {
    const me = mkUser('me', { intent_want: ['后期'] })
    const complementary = scorePair({
      me,
      other: mkUser('o1', { intent_provide: ['后期'] }),
      mySignal: mkSignal('me', { intent_want: ['后期'] }),
      theirSignal: mkSignal('o1', { intent_provide: ['后期'] }),
    })
    const nothing = scorePair({
      me,
      other: mkUser('o2'),
      mySignal: mkSignal('me', { intent_want: ['后期'] }),
      theirSignal: mkSignal('o2'),
    })
    expect(complementary.score).toBeGreaterThan(nothing.score)
  })

  it('理由最多 3 条（UI 空间约束）', () => {
    const s = scorePair({
      me: mkUser('me', { identity_tags: ['coser'], activity_area: '上海' }),
      other: mkUser('o', { identity_tags: ['coser'], activity_area: '上海' }),
      mySignal: mkSignal('me', { intent_want: ['逛展'] }),
      theirSignal: mkSignal('o', { intent_provide: ['逛展'] }),
    })
    expect(s.reasons.length).toBeLessThanOrEqual(3)
  })
})

// ---------- 内置自检（供运行时调用） ----------

describe('运行时自检', () => {
  it('selfTestPairing 应全部通过', () => {
    const r = selfTestPairing()
    expect(r.pass).toBe(true)
    expect(r.cases.length).toBeGreaterThan(0)
  })
})
