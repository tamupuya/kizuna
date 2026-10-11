// src/lib/zodiac.ts
// 12 星座中英映射（与 ZodiacPicker.vue 保持一致）

export interface ZodiacEntry {
  code: string
  name: string
  date: string
  color: string
}

export const ZODIAC_OPTIONS: ZodiacEntry[] = [
  { code: 'aquarius',    name: '水瓶座', date: '1.20 - 2.18',  color: '#06b6d4' },
  { code: 'pisces',      name: '双鱼座', date: '2.19 - 3.20',  color: '#a855f7' },
  { code: 'aries',       name: '白羊座', date: '3.21 - 4.19',  color: '#ef4444' },
  { code: 'taurus',      name: '金牛座', date: '4.20 - 5.20',  color: '#84cc16' },
  { code: 'gemini',      name: '双子座', date: '5.21 - 6.21',  color: '#f59e0b' },
  { code: 'cancer',      name: '巨蟹座', date: '6.22 - 7.22',  color: '#6b7280' },
  { code: 'leo',         name: '狮子座', date: '7.23 - 8.22',  color: '#f97316' },
  { code: 'virgo',       name: '处女座', date: '8.23 - 9.22',  color: '#0ea5e9' },
  { code: 'libra',       name: '天秤座', date: '9.23 - 10.23', color: '#ec4899' },
  { code: 'scorpio',     name: '天蝎座', date: '10.24 - 11.22', color: '#7c2d12' },
  { code: 'sagittarius', name: '射手座', date: '11.23 - 12.21', color: '#1e3a8a' },
  { code: 'capricorn',   name: '摩羯座', date: '12.22 - 1.19', color: '#374151' },
]

const ZODIAC_MAP: Record<string, ZodiacEntry> = Object.fromEntries(
  ZODIAC_OPTIONS.map(z => [z.code, z])
)

export function getZodiac(code: string | null | undefined): ZodiacEntry | null {
  if (!code) return null
  return ZODIAC_MAP[code] ?? null
}

export function getZodiacName(code: string | null | undefined): string {
  return getZodiac(code)?.name ?? ''
}

export function getZodiacColor(code: string | null | undefined): string {
  return getZodiac(code)?.color ?? '#6b7280'
}

// 兼容旧字段：可能直接是中文字符串
export function normalizeZodiac(code: string | null | undefined): string {
  if (!code) return ''
  // 已经是中文（兼容旧数据）直接返回
  if (/[\u4e00-\u9fa5]/.test(code)) return code
  return getZodiacName(code)
}

// 从 intent_want 数组里提取 MBTI（实际数据存法）
export function extractMbti(intentWant: string[] | null | undefined): string | null {
  if (!Array.isArray(intentWant)) return null
  const m = intentWant.find(s => s && s.startsWith('mbti:'))
  return m ? m.slice(5) : null
}