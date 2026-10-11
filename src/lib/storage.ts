/**
 * 绊 - Supabase Storage 上传封装
 * 2026-07-28：中谷店图片从 localStorage dataURL 升级到 Supabase Storage 公开 URL
 *
 * 路径约定：
 * - listing-images/{user_id}/{listing_id}/{timestamp}.{ext}
 * - qr-codes/{user_id}/{kind}_{timestamp}.png  (含水印图)
 *
 * 桶：zhonggu-images（public read, public write）
 */
import { supabase } from './supabase'

const BUCKET = 'zhonggu-images'

export interface UploadResult {
  url: string
  path: string
}

export interface UploadedImage extends UploadResult {
  isCover?: boolean
}

/**
 * 上传图片到指定路径
 * @param file Blob/文件对象
 * @param path 桶内路径，如 'listings/uid/lid/1234.jpg'
 * @returns 公开 URL 与存储路径
 */
export async function uploadImage(file: Blob, path: string): Promise<UploadResult> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: (file as any).type || 'image/jpeg',
    })

  if (error) throw error

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return {
    url: pub.publicUrl,
    path: data.path,
  }
}

/**
 * 删除图片
 */
export async function deleteImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

/**
 * 从 URL 推断存储路径（用于删除旧图）
 */
export function pathFromUrl(url: string): string | null {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return null
  try {
    const u = new URL(url)
    // path 形如 /storage/v1/object/public/zhonggu-images/listings/xxx.jpg
    const segs = u.pathname.split(`/public/${BUCKET}/`)
    return segs.length === 2 ? segs[1] : null
  } catch {
    return null
  }
}

/**
 * 中谷店商品图：上传并返回 URL（单张）
 */
export async function uploadListingImage(
  userId: string,
  listingId: string,
  file: Blob,
  index = 0
): Promise<UploadResult> {
  const ext = (file as any).type?.split('/')[1] || 'jpg'
  const ts = Date.now()
  const path = `listings/${userId}/${listingId}/${ts}_${index}.${ext}`
  return uploadImage(file, path)
}

/**
 * 中谷店商品图：批量上传（FormView 使用）
 * @param files 文件列表
 * @param userId 当前用户（uid）
 * @param listingId 可选。提供后路径更规整；不提供则用临时组
 */
export async function uploadListingImages(
  files: Blob[],
  userId: string,
  listingId?: string
): Promise<UploadedImage[]> {
  const lid = listingId || `pending-${Date.now()}`
  const results: UploadedImage[] = []
  for (let i = 0; i < files.length; i++) {
    const r = await uploadListingImage(userId, lid, files[i], i)
    results.push({ ...r, isCover: i === 0 })
  }
  return results
}

/**
 * 收款码（含水印）：上传并返回 URL
 */
export async function uploadQrCode(
  userId: string,
  kind: 'wechat' | 'alipay',
  watermarkedBlob: Blob
): Promise<UploadResult> {
  const ts = Date.now()
  const path = `qrcodes/${userId}/${kind}_${ts}.png`
  return uploadImage(watermarkedBlob, path)
}

/**
 * dataURL 转 Blob（用于把现有 canvas 输出再上传）
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}