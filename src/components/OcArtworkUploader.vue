<script setup lang="ts">
import { ref, computed } from 'vue'

type Aspect = '3/4' | '1/1'

const props = withDefaults(
  defineProps<{
    modelValue: string // 当前 artUrl
    aspect: Aspect
    userId?: string
  }>(),
  { userId: '' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:aspect', v: Aspect): void
  (e: 'error', msg: string): void
}>()

// 文件大小上限 5 MB（按用户决策）
const MAX_BYTES = 5 * 1024 * 1024

const uploading = ref(false)
const progress = ref(0)
const cropOpen = ref(false)

// 裁切状态
const cropImgUrl = ref('')
const cropImgW = ref(0)
const cropImgH = ref(0)
const cropPos = ref({ x: 0, y: 0 }) // 像素偏移
const cropScale = ref(1) // 缩放
const viewportW = ref(360)
const viewportH = ref(0)

const cropFrameW = computed(() => viewportW.value - 32)
const cropFrameH = computed(() => {
  const w = cropFrameW.value
  return props.aspect === '1/1' ? w : Math.round((w * 4) / 3)
})

const fileInputRef = ref<HTMLInputElement | null>(null)

function onPick() {
  fileInputRef.value?.click()
}

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = '' // reset
  if (!f) return
  if (!/^image\//.test(f.type)) {
    emit('error', '只支持图片文件')
    return
  }
  if (f.size > MAX_BYTES) {
    emit('error', `图片超过 5MB 上限（当前 ${(f.size / 1024 / 1024).toFixed(1)} MB），请换一张`)
    return
  }
  const url = URL.createObjectURL(f)
  const img = new Image()
  img.onload = () => {
    cropImgW.value = img.naturalWidth
    cropImgH.value = img.naturalHeight
    cropImgUrl.value = url
    // 默认让图片填满裁切框：scale = max(框w/图w, 框h/图h)
    const baseScale = Math.max(cropFrameW.value / img.naturalWidth, cropFrameH.value / img.naturalHeight)
    cropScale.value = baseScale
    // 初始居中
    cropPos.value = {
      x: (cropFrameW.value - img.naturalWidth * baseScale) / 2,
      y: (cropFrameH.value - img.naturalHeight * baseScale) / 2,
    }
    cropOpen.value = true
  }
  img.onerror = () => emit('error', '图片加载失败')
  img.src = url
}

function clampScale(delta: number) {
  const min = Math.max(cropFrameW.value / cropImgW.value, cropFrameH.value / cropImgH.value)
  const max = min * 4
  cropScale.value = Math.min(max, Math.max(min, cropScale.value + delta))
}

function moveBy(dx: number, dy: number) {
  const sw = cropImgW.value * cropScale.value
  const sh = cropImgH.value * cropScale.value
  const fw = cropFrameW.value
  const fh = cropFrameH.value
  let nx = cropPos.value.x + dx
  let ny = cropPos.value.y + dy
  nx = Math.min(0, Math.max(fw - sw, nx))
  ny = Math.min(0, Math.max(fh - sh, ny))
  cropPos.value = { x: nx, y: ny }
}

function cancelCrop() {
  URL.revokeObjectURL(cropImgUrl.value)
  cropImgUrl.value = ''
  cropOpen.value = false
}

async function confirmCrop() {
  const fw = cropFrameW.value
  const fh = cropFrameH.value
  // 导出：3:4 → 1080×1440；1:1 → 1440×1440
  // 导出图片尺寸：3:4 → 1080×1440（图片充满整个 3:4 卡片）；
  //              1:1 → 1080×1080（图片本身，渲染时占 3:4 卡片顶部 1:1 正方形，下方黑底补足）
  const outW = props.aspect === '1/1' ? 1080 : 1080
  const outH = props.aspect === '1/1' ? 1080 : 1440
  const ratio = outW / fw

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, outW, outH)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('图片读取失败'))
    img.src = cropImgUrl.value
  })
  ctx.drawImage(
    img,
    // 源裁切：从图片在裁切框中的可见区域反算
    (-cropPos.value.x) / cropScale.value,
    (-cropPos.value.y) / cropScale.value,
    fw / cropScale.value,
    fh / cropScale.value,
    // 目标：充满输出画布
    0, 0, outW, outH,
  )

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92))
  cancelCrop()
  await uploadBlob(blob)
}

async function uploadBlob(blob: Blob) {
  uploading.value = true
  progress.value = 0
  try {
    const { supabase } = await import('../lib/supabase')
    const uid = props.userId || 'anon'
    const ext = 'jpg'
    const path = `${uid}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('oc-artworks').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (error) throw error
    const { data: pub } = supabase.storage.from('oc-artworks').getPublicUrl(path)
    emit('update:modelValue', pub.publicUrl)
  } catch (e: any) {
    console.error('[OcArtworkUploader] upload failed', e)
    emit('error', '上传失败：' + (e?.message || '未知错误'))
  } finally {
    uploading.value = false
    progress.value = 0
  }
}

function removeArt() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="oc-art">
    <div class="oc-art-row">
      <span class="oc-art-label">立绘</span>
      <div class="oc-art-actions">
        <button class="oc-pick" :disabled="uploading" @click="onPick">
          {{ modelValue ? '更换图片' : '从相册选择' }}
        </button>
        <button v-if="modelValue" class="oc-remove" :disabled="uploading" @click="removeArt">移除</button>
      </div>
    </div>

    <div v-if="modelValue" class="oc-art-preview">
      <img :src="modelValue" alt="立绘预览" />
    </div>
    <div v-else class="oc-art-empty">
      <span>未选择图片</span>
      <small>支持 JPG/PNG/WebP，≤5MB</small>
    </div>

    <div v-if="uploading" class="oc-art-progress">
      <div class="oc-art-progress-bar" :style="{ width: progress + '%' }"></div>
      <span class="oc-art-progress-text">上传中… {{ progress }}%</span>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      style="display:none"
      @change="onFile"
    />

    <!-- 裁切全屏 UI -->
    <transition name="fade">
      <div v-if="cropOpen" class="crop-mask">
        <div class="crop-title">裁切图片（{{ aspect }}）</div>

        <div class="crop-viewport" ref="vp">
          <div
            class="crop-frame"
            :style="{ width: cropFrameW + 'px', height: cropFrameH + 'px' }"
          >
            <img
              class="crop-img"
              :src="cropImgUrl"
              :style="{
                width: (cropImgW * cropScale) + 'px',
                height: (cropImgH * cropScale) + 'px',
                left: cropPos.x + 'px',
                top: cropPos.y + 'px',
              }"
              draggable="false"
            />
          </div>
          <div class="crop-cover-top" :style="{ height: ((viewportH - cropFrameH) / 2 - 24) + 'px' }"></div>
          <div class="crop-cover-bottom" :style="{ height: ((viewportH - cropFrameH) / 2 - 24) + 'px' }"></div>
        </div>

        <div class="crop-toolbar">
          <button class="crop-mv" @click="moveBy(0, -20)">↑</button>
          <button class="crop-mv" @click="moveBy(0, 20)">↓</button>
          <button class="crop-mv" @click="moveBy(-20, 0)">←</button>
          <button class="crop-mv" @click="moveBy(20, 0)">→</button>
          <button class="crop-zoom" @click="clampScale(-0.1)">−</button>
          <button class="crop-zoom" @click="clampScale(0.1)">+</button>
        </div>

        <div class="crop-actions">
          <button class="crop-cancel" @click="cancelCrop">取消</button>
          <button class="crop-confirm" @click="confirmCrop">确认裁切</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.oc-art-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.oc-art-label {
  font-size: 13px;
  color: #6d6d72;
}
.oc-art-actions {
  display: flex;
  gap: 8px;
}
.oc-pick {
  background: #fff;
  border: 1px solid #6b8cae;
  color: #6b8cae;
  border-radius: 4px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.oc-pick:hover { background: #f4f7fa; }
.oc-pick:disabled { opacity: 0.5; }
.oc-remove {
  background: #fff;
  border: 1px solid #d8d8d9;
  color: #3c3c43;
  border-radius: 4px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
.oc-remove:hover { background: #f5f5f5; }

.oc-art-preview {
  margin-top: 12px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #ebebec;
  background: #f5f5f5;
}
.oc-art-preview img {
  display: block;
  width: 100%;
  max-height: 280px;
  object-fit: contain;
}
.oc-art-empty {
  margin-top: 12px;
  height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #f5f5f5;
  border: 1px dashed #d8d8d9;
  border-radius: 4px;
  color: #9d9da0;
  font-size: 13px;
}
.oc-art-empty small { font-size: 11px; }

.oc-art-progress {
  margin-top: 10px;
  height: 24px;
  background: #f5f5f5;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}
.oc-art-progress-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: #6b8cae;
  transition: width 0.2s ease;
}
.oc-art-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #3c3c43;
}

/* 裁切全屏遮罩 */
.crop-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #0e0e1a;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}
.crop-title {
  color: #fff;
  font-size: 14px;
  letter-spacing: 0.04em;
  margin-bottom: 18px;
}
.crop-viewport {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}
.crop-frame {
  position: relative;
  overflow: hidden;
  background: #000;
  border-radius: 4px;
  z-index: 2;
}
.crop-img {
  position: absolute;
  user-select: none;
  -webkit-user-drag: none;
}
.crop-cover-top,
.crop-cover-bottom {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.72);
  z-index: 1;
}
.crop-cover-top { top: 0; }
.crop-cover-bottom { bottom: 0; }

.crop-toolbar {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}
.crop-mv, .crop-zoom {
  width: 44px;
  height: 44px;
  background: #fff;
  border: none;
  border-radius: 4px;
  font-size: 18px;
  color: #3c3c43;
  cursor: pointer;
}
.crop-mv:hover, .crop-zoom:hover { background: #f5f5f5; }

.crop-actions {
  display: flex;
  gap: 12px;
  width: 100%;
  max-width: 360px;
}
.crop-cancel, .crop-confirm {
  flex: 1;
  height: 44px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
}
.crop-cancel {
  background: #fff;
  color: #3c3c43;
  border: 1px solid #d8d8d9;
}
.crop-confirm {
  background: #6b8cae;
  color: #fff;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>