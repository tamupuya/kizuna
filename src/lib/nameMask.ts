// nameMask.ts
// 昵称隐私化：单字 → X女士/Y先生/Z保密；≥2 字 → 首字母 + 黑块
// KUukiovo + hide_name=true → "K████"
// 小明 + hide_name=true → "小██"

export type GenderForMask = 'male' | 'female' | 'private'

/**
 * 判断字符"单字"的判定：英文/中文/数字 都算一个字符
 * - 1 个字（任意字符）→ 单字处理
 * - ≥ 2 字 → 首字母 + 黑块
 */
const MAX_NAME_LEN = 20

export function maskName(
  name: string | null | undefined,
  gender: GenderForMask = 'private',
  hideName: boolean = false
): string {
  if (!name) return ''
  name = name.slice(0, MAX_NAME_LEN).trim()

  // 不隐藏 → 原样显示
  if (!hideName) return name

  // 单字
  if ([...name].length === 1) {
    const ch = [...name][0]
    if (gender === 'female') return `${ch}女士`
    if (gender === 'male')   return `${ch}先生`
    return `${ch}保密`  // gender === 'private'
  }

  // ≥ 2 字 → 首字母 + 黑块（伪造马克笔涂改）
  const first = [...name][0]
  const restLen = [...name].length - 1
  const block = '█'.repeat(Math.max(2, restLen))
  return `${first}${block}`
}

/**
 * 渲染为带样式的 HTML 片段（用于 v-html）
 * 黑块部分用 .kz-name-mask 类（黑色长条）
 */
// hardening: maskNameHTML 需要调用方用 v-html 渲染；
// 默认 maskName 返回纯文本，更安全；HTML 版本仅用于必须显示黑块的场景。

// (currently unused) 保留供未来 v-html 场景使用
export function maskNameHTML(
  name: string | null | undefined,
  gender: GenderForMask = 'private',
  hideName: boolean = false
): string {
  if (!name) return ''
  if (!hideName) return escapeHtml(name)

  if ([...name].length === 1) {
    const ch = [...name][0]
    if (gender === 'female') return escapeHtml(ch + '女士')
    if (gender === 'male')   return escapeHtml(ch + '先生')
    return escapeHtml(ch + '保密')
  }

  const first = [...name][0]
  const restLen = [...name].length - 1
  const block = '█'.repeat(Math.max(2, restLen))
  return `<span class="kz-name-real">${escapeHtml(first)}</span><span class="kz-name-mask">${block}</span>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
