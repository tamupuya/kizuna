// src/lib/mbti.ts
// 16 种 MBTI 中英文映射（与 MbtiPicker.vue 保持一致）

export interface MbtiEntry {
  code: string
  name: string
  group: string
  color: string
}

export const MBTI_CODES = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
] as const

export const MBTI_OPTIONS: MbtiEntry[] = [
  { code: 'INTJ', name: '建筑师',   group: '分析师', color: '#5b6b8a' },
  { code: 'INTP', name: '逻辑学家', group: '分析师', color: '#7a8aa8' },
  { code: 'ENTJ', name: '指挥官',   group: '分析师', color: '#3d4d6b' },
  { code: 'ENTP', name: '辩论家',   group: '分析师', color: '#5b6b8a' },
  { code: 'INFJ', name: '提倡者',   group: '理想主义者', color: '#a8888a' },
  { code: 'INFP', name: '调停者',   group: '理想主义者', color: '#c4a3a3' },
  { code: 'ENFJ', name: '主人公',   group: '理想主义者', color: '#946d6f' },
  { code: 'ENFP', name: '竞选者',   group: '理想主义者', color: '#b08a8a' },
  { code: 'ISTJ', name: '物流师',   group: '守护者', color: '#5d7a6a' },
  { code: 'ISFJ', name: '守卫者',   group: '守护者', color: '#7a9580' },
  { code: 'ESTJ', name: '总经理',   group: '守护者', color: '#3d5a4a' },
  { code: 'ESFJ', name: '执政官',   group: '守护者', color: '#5d7a6a' },
  { code: 'ISTP', name: '鉴赏家',   group: '探险家', color: '#8a8a5b' },
  { code: 'ISFP', name: '探险家',   group: '探险家', color: '#a8a87a' },
  { code: 'ESTP', name: '企业家',   group: '探险家', color: '#6b6b3d' },
  { code: 'ESFP', name: '表演者',   group: '探险家', color: '#8a8a5b' },
]

const MBTI_MAP: Record<string, MbtiEntry> = Object.fromEntries(
  MBTI_OPTIONS.map(m => [m.code, m])
)

export function getMbti(code: string | null | undefined): MbtiEntry | null {
  if (!code) return null
  return MBTI_MAP[code] || null
}

export function getMbtiName(code: string | null | undefined): string {
  const m = getMbti(code)
  return m ? `${m.code} · ${m.name}` : ''
}

/**
 * 健壮提取：兼容多种存储形态
 * - 'INTJ' 直接 4 字母
 * - 'mbti:INTJ' 带前缀
 * - 'MBTI: INTJ' / 'mbti=INTJ'
 * - 中文 'INTJ · 建筑师' / '建筑师'
 */
export function extractMbtiRobust(input: string | string[] | null | undefined): string | null {
  if (!input) return null
  const candidates: string[] = Array.isArray(input)
    ? input
    : [String(input)]
  for (const raw of candidates) {
    if (!raw) continue
    const s = String(raw).trim()
    // 精确匹配 4 字母
    if (MBTI_CODES.includes(s as any)) return s
    // 前缀匹配 mbti:INTJ / mbti=INTJ / mbti INTJ
    const m = s.match(/^mbti[:\s=]+([A-Z]{4})$/i)
    if (m && MBTI_CODES.includes(m[1].toUpperCase() as any)) return m[1].toUpperCase()
    // 提取前 4 个大写字母
    const m2 = s.match(/\b([A-Z]{4})\b/)
    if (m2 && MBTI_CODES.includes(m2[1] as any)) return m2[1]
  }
  return null
}
