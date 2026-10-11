/**
 * 绊用户编号生成器
 *
 * 规则（2026-07-28 用户确认）：
 * - 6 位（不含 #）
 * - 默认纯数字（0-9）
 * - 用户可自行改为字母+数字混合
 * - 存储为 #XXXXXX 形式
 */

const NUMBERS = '0123456789'
const MIXED = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * 生成 6 位编号
 * @param numeric  true=纯数字默认（用户首次创建），false=字母+数字混合
 */
export function generateCode(numeric: boolean = true): string {
  const charset = numeric ? NUMBERS : MIXED
  const len = 6
  let code = ''
  const arr = new Uint32Array(len)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * charset.length)
  }
  for (let i = 0; i < len; i++) {
    code += charset[arr[i] % charset.length]
  }
  return code
}

/**
 * 校验用户输入是否合法
 * - 必须是 6 位
 * - 仅允许 0-9 和 A-Z
 */
export function isValidCode(code: string): boolean {
  if (!code) return false
  if (code.length !== 6) return false
  return /^[0-9A-Z]{6}$/.test(code)
}

/**
 * 规范化为大写（输入时自动转大写）
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6)
}

/**
 * 验证 reason 枚举（与 image#1 对齐）
 */
export type CodeValidationReason = 'empty' | 'length' | 'format' | 'name_code_duplicate' | 'ok'

export interface CodeValidation {
  ok: boolean
  reason: CodeValidationReason
  message: string
}

/**
 * 完整校验编号（2026-08-02 按 image#1 实现）：
 * - empty: 未输入
 * - length: 不是 6 位
 * - format: 含非法字符
 * - name_code_duplicate: 编号 + 昵称同时重名（宽版校验）
 * - ok: 全部通过
 *
 * 宽版规则（用户 07-30 决策）：
 * - 编号相同但昵称不同 → ok 绿（不冲突，允许）
 * - 编号相同 且 昵称相同 → name_code_duplicate ×（冲突）
 */
export function validateCode(
  code: string,
  currentCn: string,
  users: Array<{ id?: string; code?: string; cn?: string }>,
  selfId?: string,
): CodeValidation {
  if (!code) {
    return { ok: false, reason: 'empty', message: '待定' }
  }
  if (code.length !== 6) {
    return { ok: false, reason: 'length', message: '待定' }
  }
  if (!/^[0-9A-Z]{6}$/.test(code)) {
    return { ok: false, reason: 'format', message: '待定' }
  }
  // 宽版重名检测：同编号 + 同昵称 = 冲突
  const dup = users.find(u => u.id !== selfId && u.code === code && u.cn === currentCn)
  if (dup) {
    return { ok: false, reason: 'name_code_duplicate', message: '待定' }
  }
  return { ok: true, reason: 'ok', message: '待定' }
}