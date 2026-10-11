/**
 * roomPassword — 同窗会房间密码的哈希处理
 *
 * 背景（v0.10，2026-10-03）：
 * 原实现把房间密码【明文】存入 Supabase 的 radar_rooms.password，
 * 前端用 `room.password === input` 直接比对。后果：
 *   1. 任何能 SELECT radar_rooms 的人都能直接读到所有房间的密码
 *   2. 用户若复用同一个 PIN（很多人会），一处泄露等于多处泄露
 *
 * 【本方案做了什么】
 * 存储 SHA-256 哈希，比对时把用户输入哈希后与存储值比较。
 * 明文不再落库 → 解决上面两个问题。
 *
 * 【本方案没做什么（务必知悉）】
 * 这不是真正的访问控制。哈希随房间数据一起下发给所有客户端，
 * 而 4-6 位纯数字的搜索空间只有 10^4 ~ 10^6，
 * 有心者可瞬间穷举出原文。
 * 真正安全的做法是【服务端校验】：客户端只提交密码，
 * 由 Supabase RPC（security definer）比对后返回布尔值，
 * 密码与哈希都不出服务端。该改造需要手跑 SQL，列为 P1。
 *
 * 【兼容性】
 * 早期创建的、以明文存储的房间，其 password 值不匹配任何哈希，
 * 因此旧房间的密码将无法通过校验。房间本身是短时临时的、
 * 且会被 purgeStaleRooms 回收，影响可忽略。
 */

/** 是否为合法房间密码：4-6 位纯数字 */
export function isValidRoomPassword(pw: string): boolean {
  return /^\d{4,6}$/.test(pw)
}

/**
 * 计算 SHA-256 十六进制摘要
 * 优先走 Web Crypto（需安全上下文）；不可用时降级为 FNV-1a 变体。
 *
 * 注：降级路径弱得多，仅用于极端环境避免功能完全不可用。
 * Capacitor WebView 与 https 页面均为安全上下文，正常走 Web Crypto。
 */
export async function hashRoomPassword(pw: string): Promise<string> {
  const input = `kizuna-room:${pw}` // 加盐前缀，避免与通用 SHA-256 彩虹表直接对应

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    }
  } catch (e) {
    console.warn('[roomPassword] Web Crypto 不可用，降级到弱哈希:', e)
  }

  // 降级：FNV-1a 32 位（弱，仅避免功能不可用）
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'fnv1a:' + h.toString(16).padStart(8, '0')
}

/**
 * 校验房间密码
 * @param input 用户输入的明文
 * @param stored 房间存储的哈希值
 */
export async function verifyRoomPassword(input: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const h = await hashRoomPassword(input)
  return h === stored
}
