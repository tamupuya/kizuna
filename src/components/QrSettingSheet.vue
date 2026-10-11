<script setup lang="ts">
/**
 * 绊 - 收款码设置弹窗 (ProfileView 触发)
 *
 * 设计要点：
 * - 在用户的"我的"页设置，选填：微信收款码 / 支付宝收款码
 * - canvas 本地预水印 → Supabase Storage 上传
 * - 保存到 user.contact JSONB（wechat_qr / alipay_qr）
 * - 用户首次上传时立即自动加水印防 PS 盗窃
 */
import { ref, computed } from 'vue'
import { useKizunaStore } from '../stores/kizuna'
import { uploadQrCode, deleteImage, pathFromUrl } from '../lib/storage'
import { useAlertStore } from '../stores/alert'

const props = defineProps<{
  initial: { wechat: string | null; alipay: string | null }
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useKizunaStore()
const alert = useAlertStore()

const wechat = ref<string | null>(props.initial.wechat)
const alipay = ref<string | null>(props.initial.alipay)
const uploading = ref(false)
const saving = ref(false)

// 在用户上传图片之后立刻铺一层 "CN#CODE" 半透明文字
// 返回带水印的 Blob（PNG）
async function watermarkImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  await new Promise((res, rej) => {
    img.onload = res
    img.onerror = rej
  })
  URL.revokeObjectURL(url)

  const user = store.currentUser as any
  const cn = user?.cn || 'kizuna'
  const code = user?.code || '------'

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  // 计算水印字号（图片最大边 1/18）
  const baseSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) / 18))
  ctx.font = `bold ${baseSize}px sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 2
  ctx.textBaseline = 'middle'

  const watermark = `${cn} #${code}`
  const stepY = baseSize * 4
  for (let y = 0; y < canvas.height + stepY; y += stepY) {
    const offsetX = (y / stepY) % 2 === 0 ? 0 : 60
    for (let x = -canvas.width; x < canvas.width * 2; x += ctx.measureText(watermark).width + 80) {
      ctx.save()
      ctx.translate(x + offsetX, y - canvas.height / 2 + baseSize * 3)
      ctx.rotate(-22 * Math.PI / 180)
      ctx.strokeText(watermark, 0, 0)
      ctx.fillText(watermark, 0, 0)
      ctx.restore()
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
  })
}

async function onSelect(kind: 'wechat' | 'alipay', e: Event) {
  const t = e.target as HTMLInputElement
  const file = t.files?.[0]
  t.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    alert.warn('请上传图片')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    alert.warn('图片不能超过 5MB')
    return
  }

  if (!store.currentUserId) {
    alert.warn('请先登录')
    return
  }

  uploading.value = true
  try {
    // 1. canvas 加水印 -> PNG Blob
    const watermarkedBlob = await watermarkImage(file)
    // 2. 上传到 Supabase Storage
    const { url } = await uploadQrCode(store.currentUserId, kind, watermarkedBlob)
    // 3. 旧图清理（如果有可解析的 storage 路径）
    const oldUrl = kind === 'wechat' ? wechat.value : alipay.value
    const oldPath = oldUrl ? pathFromUrl(oldUrl) : null
    if (oldPath) {
      deleteImage(oldPath).catch(() => { /* 容错 */ })
    }
    // 4. 替换本地 url
    if (kind === 'wechat') wechat.value = url
    else alipay.value = url
  } catch (err: any) {
    alert.error('上传失败', err.message || String(err))
  } finally {
    uploading.value = false
  }
}

function removeQr(kind: 'wechat' | 'alipay') {
  if (kind === 'wechat') wechat.value = null
  else alipay.value = null
}

async function save() {
  if (!store.currentUserId) {
    alert.warn('请先登录')
    return
  }
  saving.value = true
  const ok = await store.saveQrCodes(store.currentUserId, wechat.value, alipay.value)
  saving.value = false
  if (ok) {
    alert.success('已保存')
    emit('close')
  } else {
    alert.error('保存失败，请重试')
  }
}

const doneCount = computed(() => (wechat.value ? 1 : 0) + (alipay.value ? 1 : 0))
</script>

<template>
  <Teleport to="body">
    <div class="qs-mask" @click.self="emit('close')">
      <div class="qs-sheet" role="dialog" aria-label="QR codes">
        <div class="qs-handle"></div>

        <header class="qs-header">
          <h3 class="qs-title">QR Codes</h3>
          <p class="qs-sub">Setup {{ doneCount }} / 2 · Optional · Only visible to buyers who claimed</p>
        </header>

        <div class="qs-body">
          <!-- WeChat -->
          <section class="qs-card">
            <div class="qs-card-head">
              <span class="qs-kind-name">WeChat QR</span>
              <span class="qs-card-meta">{{ wechat ? 'Set' : 'Empty' }}</span>
            </div>
            <div class="qs-preview">
              <template v-if="wechat">
                <img :src="wechat" alt="WeChat QR" class="qs-qr-img" />
                <button @click="removeQr('wechat')" class="qs-remove">Remove</button>
              </template>
              <label v-else class="qs-empty">
                <input
                  type="file"
                  accept="image/*"
                  class="qs-input-hidden"
                  @change="onSelect('wechat', $event)"
                  :disabled="uploading"
                />
                <span class="qs-empty-plus" v-if="!uploading">+</span>
                <span class="qs-empty-spinner" v-else>…</span>
                <span class="qs-empty-hint">Tap to upload</span>
              </label>
            </div>
          </section>

          <!-- Alipay -->
          <section class="qs-card">
            <div class="qs-card-head">
              <span class="qs-kind-name">Alipay QR</span>
              <span class="qs-card-meta">{{ alipay ? 'Set' : 'Empty' }}</span>
            </div>
            <div class="qs-preview">
              <template v-if="alipay">
                <img :src="alipay" alt="Alipay QR" class="qs-qr-img" />
                <button @click="removeQr('alipay')" class="qs-remove">Remove</button>
              </template>
              <label v-else class="qs-empty">
                <input
                  type="file"
                  accept="image/*"
                  class="qs-input-hidden"
                  @change="onSelect('alipay', $event)"
                  :disabled="uploading"
                />
                <span class="qs-empty-plus" v-if="!uploading">+</span>
                <span class="qs-empty-spinner" v-else>…</span>
                <span class="qs-empty-hint">Tap to upload</span>
              </label>
            </div>
          </section>

          <div class="qs-note">
            <span>Auto watermarked: CN + Code. Only buyers with active request can view.</span>
          </div>
        </div>

        <footer class="qs-footer">
          <button @click="emit('close')" class="qs-cancel">Cancel</button>
          <button @click="save" class="qs-confirm" :disabled="saving || uploading">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.qs-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
}

.qs-sheet {
  background: #fffaf0;
  width: 100%;
  max-width: 480px;
  max-height: 92vh;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 24px rgba(43, 42, 38, 0.18);
  overflow: hidden;
}

.qs-handle {
  width: 36px;
  height: 4px;
  background: #d4cfc4;
  border-radius: 2px;
  margin: 8px auto 4px;
  flex-shrink: 0;
}

.qs-header {
  padding: 8px 20px 14px;
  border-bottom: 1px solid #f0ede5;
  flex-shrink: 0;
}

.qs-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #2b2a26;
}

.qs-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a8a39a;
}

.qs-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qs-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid #f0ede5;
}

.qs-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.qs-kind-emoji {
  font-size: 18px;
}

.qs-kind-name {
  font-size: 15px;
  font-weight: 700;
  color: #2b2a26;
  flex: 1;
}

.qs-card-meta {
  font-size: 11px;
  padding: 2px 8px;
  background: #f0ede5;
  color: #5c5953;
  border-radius: 999px;
}

.qs-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-width: 220px;
  margin: 0 auto;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  overflow: hidden;
  background: #fafaf8;
}

.qs-qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #ffffff;
}

.qs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: pointer;
  background: #fafaf8;
  transition: all 0.18s ease;
}

.qs-empty:hover {
  background: #fff5dc;
}

.qs-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.qs-empty-plus {
  font-size: 32px;
  color: #b8ad95;
  line-height: 1;
}

.qs-empty-spinner {
  font-size: 24px;
  color: #b8ad95;
}

.qs-empty-hint {
  font-size: 11px;
  color: #a8a39a;
  margin-top: 6px;
}

.qs-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.qs-note {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #8c8780;
  line-height: 1.5;
  padding: 10px 12px;
  background: #fff5dc;
  border: 1px dashed #e0dcd4;
  border-radius: 10px;
}

.qs-footer {
  display: flex;
  gap: 10px;
  padding: 14px 20px 24px;
  border-top: 1px solid #f0ede5;
  flex-shrink: 0;
  background: #fffaf0;
}

.qs-cancel {
  flex: 1;
  padding: 13px;
  border-radius: 12px;
  background: #ffffff;
  color: #5c5953;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid #e8e6e1;
  cursor: pointer;
  font-family: inherit;
}

.qs-confirm {
  flex: 1;
  padding: 13px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.qs-confirm:disabled {
  opacity: 0.5;
  cursor: wait;
}
</style>