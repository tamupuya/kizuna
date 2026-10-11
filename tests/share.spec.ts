import { describe, it, expect } from 'vitest'
import { buildCardText } from '../src/lib/share'

describe('分享 · 卡片摘要文本（形态 C）', () => {
  it('包含 CN 与编号', () => {
    const t = buildCardText({ cn: '阿宅喵', code: 'A3F2K9' })
    expect(t).toContain('阿宅喵')
    expect(t).toContain('#A3F2K9')
  })

  it('包含 MBTI 与活动地区', () => {
    const t = buildCardText({ cn: 'A', mbti: 'INTJ', activity_area: '上海' })
    expect(t).toContain('INTJ')
    expect(t).toContain('上海')
  })

  it('身份标签用 / 连接', () => {
    const t = buildCardText({ cn: 'A', identity_tags: ['画师', 'coser'] })
    expect(t).toContain('画师 / coser')
  })

  it('兴趣优先取 state=C 且有作品的分类名', () => {
    const t = buildCardText({
      cn: 'A',
      interest_categories: [
        { name: '插画', state: 'C', works: ['鬼灭'] },
        { name: '游戏', state: 'B', works: [] },
      ],
    })
    expect(t).toContain('插画')
    expect(t).not.toContain('游戏')
  })

  it('意图最多各取 3 个', () => {
    const t = buildCardText({
      cn: 'A',
      intent_want_meet: ['a', 'b', 'c', 'd'],
      intent_provide: ['x'],
    })
    expect(t).toContain('想认识：a、b、c')
    expect(t).not.toContain('想认识：a、b、c、d')
    expect(t).toContain('能提供：x')
  })

  it('不含联系方式（隐私底线）', () => {
    const t = buildCardText({
      cn: 'A',
      contact: { wechat: 'secret123', phone: '13800000000' },
      wechat: 'leak',
    })
    expect(t).not.toContain('secret123')
    expect(t).not.toContain('13800000000')
    expect(t).not.toContain('leak')
  })

  it('空用户不抛错', () => {
    expect(() => buildCardText(undefined)).not.toThrow()
    expect(() => buildCardText({})).not.toThrow()
  })

  it('结尾带品牌署名', () => {
    const t = buildCardText({ cn: 'A' })
    expect(t).toContain('绊 KIZUNA')
  })
})
