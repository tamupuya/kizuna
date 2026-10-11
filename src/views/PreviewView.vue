<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import CardPreview from '../components/CardPreview.vue'
import ShareCard from '../components/ShareCard.vue'
import { useAlertStore } from '../stores/alert'
import { shareCardImage, shareCardText } from '../lib/share'

const router = useRouter()
const store = useKizunaStore()
const alert = useAlertStore()

const shareCardRef = ref<HTMLElement | null>(null)
const sharingImg = ref(false)

onMounted(async () => {
  await store.init()
})

// 2026-10-07：分享改为「导出图片 / 文本」，不再分享 APP 内不可用的 localhost 链接
async function shareImage() {
  if (!store.currentUser || !shareCardRef.value || sharingImg.value) return
  sharingImg.value = true
  try {
    const r = await shareCardImage(shareCardRef.value, store.currentUser.cn || '')
    if (r === 'shared') alert.success('已分享')
    else if (r === 'downloaded') alert.success('已保存图片', '图片已保存到设备')
  } catch (e: any) {
    alert.error('分享失败', e?.message || '请稍后重试')
  } finally {
    sharingImg.value = false
  }
}

async function shareText() {
  if (!store.currentUser) return
  try {
    const r = await shareCardText(store.currentUser)
    if (r === 'shared') alert.success('已分享')
    else if (r === 'copied') alert.success('已复制卡片摘要', '可粘贴到任意聊天窗口')
  } catch (e: any) {
    alert.error('分享失败', e?.message || '请稍后重试')
  }
}
</script>

<template>
  <div class="preview-page" v-if="store.currentUser">
    <div class="top-bar">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="page-title">人设卡预览</h1>
      <button @click="shareImage" class="share-btn" title="分享图片" :disabled="sharingImg">分享</button>
    </div>

    <div class="preview-shell">
      <CardPreview :user="store.currentUser" />

      <div class="action-row">
        <button @click="shareText" class="action-btn-secondary">
          复制文本
        </button>
        <button @click="shareImage" class="action-btn-primary" :disabled="sharingImg">
          {{ sharingImg ? '生成中…' : '分享图片' }}
        </button>
      </div>
      <button @click="router.push('/editor')" class="action-btn-ghost">编辑名片</button>
      <button @click="router.push('/home')" class="action-btn-ghost">完成</button>
    </div>

    <!-- 离屏分享卡（导出用） -->
    <Teleport to="body">
      <div class="share-offscreen" aria-hidden="true">
        <div ref="shareCardRef">
          <ShareCard :user="store.currentUser" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.preview-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 480px;
  margin: 0 auto 16px;
}

.back-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
}

.share-btn {
  background: none;
  border: 1px solid #e8e6e1;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: #2b2a26;
  cursor: pointer;
}

.share-btn:hover {
  background: #fafaf8;
}

.preview-shell {
  max-width: 480px;
  margin: 0 auto;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 10px;
  margin-top: 16px;
}

.action-btn-ghost {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: none;
  background: none;
  color: #8b7355;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn-ghost:hover {
  color: #2b2a26;
}

.share-btn:disabled {
  opacity: 0.5;
}

/* 离屏分享卡 */
.share-offscreen {
  position: fixed;
  left: -10000px;
  top: 0;
  z-index: -1;
  pointer-events: none;
}

.action-btn-primary,
.action-btn-secondary {
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
}

.action-btn-primary {
  background: #2b2a26;
  color: #fff5dc;
}

.action-btn-primary:hover {
  background: #3a3528;
}

.action-btn-secondary {
  background: #ffffff;
  color: #2b2a26;
  border: 1px solid #e8e6e1;
}

.action-btn-secondary:hover {
  background: #fafaf8;
}
</style>