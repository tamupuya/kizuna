/**
 * 绊 - 人设卡分享
 * 2026-10-07
 *
 * 提供两种分享形态（对应设计文档 形态 A + C）：
 * - A 图片分享：把竖版卡 DOM 渲染成 PNG，走系统分享面板（微信/QQ/保存相册）
 * - C 文本分享：复制/分享卡片摘要文字（可附 App 下载链接）
 *
 * 平台策略：
 * - 原生（Capacitor Android）：@capacitor/filesystem 写缓存 → @capacitor/share 拉起系统面板
 * - Web：优先 navigator.share(files)；退化为下载 PNG
 *
 * 隐私：导出的卡不含联系方式（见 ShareCard.vue，本来就不渲染 contact）
 */
import { toPng } from 'html-to-image'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/**
 * App 下载链接（分享给站外用户时附带）。
 * TODO: 公网部署 / 分发 APK 后填入真实地址。
 * 形状示例：'https://kizuna.pages.dev' 或 APK 下载页。
 * 留空则分享文案不带链接。
 */
export const APP_DOWNLOAD_URL = ''

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** Blob → base64（不含 data: 前缀），用于写文件 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('read blob failed'))
    reader.readAsDataURL(blob)
  })
}

/** 1x1 透明 PNG（头像跨域取不到时的占位，避免整张导出失败） */
const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * 把指定 DOM 节点导出为 PNG Blob
 * @param el 目标元素（离屏渲染的 ShareCard 容器）
 */
export async function exportCardPng(el: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(el, {
    pixelRatio: 3,          // 高清（375px 宽 → 1125px）
    cacheBust: true,
    backgroundColor: '#fffcf5',
    // 头像来自 Supabase Storage（跨域）；若取不到则用透明占位，不让整张导出失败
    imagePlaceholder: TRANSPARENT_PX,
  })
  const res = await fetch(dataUrl)
  return await res.blob()
}

/**
 * 分享卡片图片（形态 A）
 * @returns 'shared' | 'downloaded' | 'cancelled'
 */
export async function shareCardImage(el: HTMLElement, cn: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await exportCardPng(el)
  const caption = buildShareCaption(cn)

  // 1) 原生：写缓存文件 → 系统分享面板
  if (isNative()) {
    try {
      const base64 = await blobToBase64(blob)
      const fileName = `kizuna-card-${Date.now()}.png`
      const write = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      })
      await Share.share({
        title: `${cn} 的人设卡`,
        text: caption,
        url: write.uri,
        dialogTitle: '分享人设卡',
      })
      return 'shared'
    } catch (e: any) {
      // 用户取消分享面板：Capacitor 抛 "Share canceled"
      if (String(e?.message || e).toLowerCase().includes('cancel')) return 'cancelled'
      // 其他失败 → 落到下载兜底
      console.warn('[share] native share failed, fallback to download', e)
    }
  }

  // 2) Web：优先 navigator.share(files)
  const file = new File([blob], `kizuna-card-${Date.now()}.png`, { type: 'image/png' })
  const nav: any = navigator
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${cn} 的人设卡`, text: caption })
      return 'shared'
    } catch (e: any) {
      if (String(e?.name || '') === 'AbortError') return 'cancelled'
      // 落到下载
    }
  }

  // 3) 兜底：下载 PNG
  downloadBlob(blob, `kizuna-card-${Date.now()}.png`)
  return 'downloaded'
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 构造卡片摘要文本（形态 C） */
export function buildCardText(user: any): string {
  const lines: string[] = []
  const cn = user?.cn || ''
  const code = user?.code ? `#${user.code}` : ''
  lines.push(`${cn} ${code}`.trim())

  const meta: string[] = []
  if (user?.mbti) meta.push(String(user.mbti))
  if (user?.activity_area) meta.push(String(user.activity_area))
  if (meta.length) lines.push(meta.join(' · '))

  const ids: string[] = user?.identity_tags || []
  if (ids.length) lines.push('身份：' + ids.join(' / '))

  const cats = (user?.interest_categories || []).filter(
    (c: any) => c.state === 'C' && c.works && c.works.length > 0
  )
  if (cats.length) {
    lines.push('兴趣：' + cats.map((c: any) => c.name).join(' / '))
  } else if ((user?.interest_tags || []).length) {
    lines.push('兴趣：' + user.interest_tags.join(' / '))
  }

  if ((user?.intent_want_meet || []).length) {
    lines.push('想认识：' + user.intent_want_meet.slice(0, 3).join('、'))
  }
  if ((user?.intent_provide || []).length) {
    lines.push('能提供：' + user.intent_provide.slice(0, 3).join('、'))
  }

  const tail = APP_DOWNLOAD_URL ? `\n\n—— 来自「绊 KIZUNA」${APP_DOWNLOAD_URL}` : '\n\n—— 来自「绊 KIZUNA」'
  return lines.join('\n') + tail
}

function buildShareCaption(cn: string): string {
  const base = `${cn} 的人设卡`
  return APP_DOWNLOAD_URL ? `${base}｜来自「绊 KIZUNA」 ${APP_DOWNLOAD_URL}` : `${base}｜来自「绊 KIZUNA」`
}

/**
 * 分享文本（形态 C）
 * @returns 'shared' | 'copied' | 'cancelled'
 */
export async function shareCardText(user: any): Promise<'shared' | 'copied' | 'cancelled'> {
  const text = buildCardText(user)

  if (isNative()) {
    try {
      await Share.share({
        title: `${user?.cn || ''} 的人设卡`,
        text,
        dialogTitle: '分享人设卡',
      })
      return 'shared'
    } catch (e: any) {
      if (String(e?.message || e).toLowerCase().includes('cancel')) return 'cancelled'
    }
  }

  const nav: any = navigator
  if (nav.share) {
    try {
      await nav.share({ title: `${user?.cn || ''} 的人设卡`, text })
      return 'shared'
    } catch (e: any) {
      if (String(e?.name || '') === 'AbortError') return 'cancelled'
    }
  }

  // 复制到剪贴板
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'cancelled'
  }
}
