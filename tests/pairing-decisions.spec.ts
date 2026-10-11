/**
 * pairing-decisions.spec.ts — 双向确认层审查（2026-10-04）
 *
 * 审查点 E：新增的 pair_decisions 层必须真正满足「双方都愿意」
 *
 * 这里审查的是一个【安全语义】：如果这一层实现错了，
 * 单方点击就能宣称「你们看见了彼此」——UI 会替对方表态。
 */

import { describe, it, expect } from 'vitest'
import { isMutual, pairKey, hasDecided, type PairDecision } from '../src/lib/pairing'

const D = (decider: string, target: string, decision: 'accept' | 'skip' = 'accept'): PairDecision => ({
  decider_id: decider,
  target_id: target,
  decision,
})

describe('审查点 E：双向确认语义', () => {
  it('pairKey 与顺序无关（A→B 与 B→A 必须同键）', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'))
  })

  it('双方都 accept → mutual', () => {
    expect(isMutual([D('a', 'b'), D('b', 'a')], 'a', 'b')).toBe(true)
  })

  it('单方 accept → 不是 mutual（不得替对方表态）', () => {
    expect(isMutual([D('a', 'b')], 'a', 'b')).toBe(false)
    expect(isMutual([D('b', 'a')], 'a', 'b')).toBe(false)
  })

  it('accept 与 skip 混合 → 不是 mutual（skip 不能被当成同意）', () => {
    expect(isMutual([D('a', 'b', 'accept'), D('b', 'a', 'skip')], 'a', 'b')).toBe(false)
  })

  it('无关的第三方表态不构成 mutual', () => {
    expect(isMutual([D('c', 'a'), D('c', 'b')], 'a', 'b')).toBe(false)
  })

  it('hasDecided：表态过（无论 accept/skip）都算已决定', () => {
    expect(hasDecided([D('a', 'b', 'accept')], 'a', 'b')).toBe(true)
    expect(hasDecided([D('a', 'b', 'skip')], 'a', 'b')).toBe(true)
    expect(hasDecided([], 'a', 'b')).toBe(false)
  })

  it('重复表态不应导致 mutual 误判（幂等）', () => {
    const dup = [D('a', 'b'), D('a', 'b'), D('b', 'a'), D('b', 'a')]
    expect(isMutual(dup, 'a', 'b')).toBe(true)
  })
})
