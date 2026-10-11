<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import OcCard from '../components/OcCard.vue'
import OcArtworkUploader from '../components/OcArtworkUploader.vue'

type Aspect = '3/4' | '1/1'

const router = useRouter()
const store = useKizunaStore()

const ocName = ref('')
const ocBio = ref('')
const ocWorld = ref('')
const ocIllust = ref('')
const ocAspect = ref<Aspect>('3/4')
const ocTags = ref<string[]>([])
const ocDescText = ref('')
const tagDraft = ref('')
const saving = ref(false)
const loaded = ref(false)
const errorMsg = ref('')

const TAG_MAX = 10
const userId = computed(() => store.currentUserId || '')

const nameLeft = computed(() => 20 - ocName.value.length)
const bioLeft = computed(() => 50 - ocBio.value.length)
const worldLeft = computed(() => 60 - ocWorld.value.length)

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('超时')), ms)),
  ])
}

onMounted(async () => {
  try {
    const me = store.currentUser as any
    const oc = me?.oc_card
    if (oc) {
      ocName.value = oc.ocName || ''
      ocBio.value = oc.ocBio || ''
      ocWorld.value = oc.ocWorld || ''
      ocIllust.value = oc.ocIllust || ''
      ocTags.value = Array.isArray(oc.ocTags) ? oc.ocTags : []
      ocDescText.value = oc.ocDescText || ''
      ocAspect.value = oc.ocAspect === '1/1' ? '1/1' : '3/4'
    }
  } catch (e) {
    console.warn('[OcEditor] load failed', e)
    errorMsg.value = '加载失败，使用空白表单'
  } finally {
    loaded.value = true
  }
})

function addTag() {
  const t = tagDraft.value.trim().replace(/^#/, '')
  if (!t || ocTags.value.length >= TAG_MAX) return
  if (ocTags.value.includes(t)) { tagDraft.value = ''; return }
  ocTags.value = [...ocTags.value, t]
  tagDraft.value = ''
}
function removeTag(t: string) {
  ocTags.value = ocTags.value.filter((x) => x !== t)
}

async function save() {
  if (!store.currentUserId) { router.push('/select'); return }
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      oc_card: {
        ocName: ocName.value.trim(),
        ocBio: ocBio.value.trim(),
        ocWorld: ocWorld.value.trim(),
        ocIllust: ocIllust.value.trim(),
        ocAspect: ocAspect.value,
        ocTags: ocTags.value,
        ocDescText: ocDescText.value.trim(),
        updatedAt: new Date().toISOString(),
      },
    }
    await withTimeout(store.updateUser(store.currentUserId, payload as any), 8000)
    router.push('/profile')
  } catch (e: any) {
    console.error('[OcEditor] save failed', e)
    errorMsg.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function cancel() { router.push('/profile') }
function onUploadError(msg: string) { errorMsg.value = msg }
</script>

<template>
  <div class="oe-root">
    <!-- 顶部 Bar (muji 风：白底 + 1px 浅底边框) -->
    <header class="oe-header">
      <button class="oe-back" @click="cancel">‹ 返回</button>
      <h1 class="oe-title">编辑 OC 卡</h1>
      <button class="oe-save" :disabled="saving" @click="save">
        {{ saving ? '保存中' : '保存' }}
      </button>
    </header>

    <div v-if="!loaded" class="oe-loading">加载中…</div>

    <main v-else class="oe-main">
      <div v-if="errorMsg" class="oe-error">{{ errorMsg }}</div>

      <!-- 实时预览 -->
      <section class="oe-preview">
        <OcCard
          :oc-name="ocName"
          :oc-bio="ocBio"
          :oc-world="ocWorld"
          :oc-illust="ocIllust"
          :oc-tags="ocTags"
          :oc-desc-text="ocDescText"
          :aspect="ocAspect"
          editing
        />
        <p class="oe-preview-tip">实时预览 · 上滑查看完整内容</p>
      </section>

      <!-- 分区 1：基本资料 -->
      <section class="oe-section">
        <h2 class="oe-section-title">基本资料</h2>
        <div class="oe-field">
          <div class="oe-label">
            <span>OC 名字</span>
            <span class="oe-count" :class="{ warn: nameLeft < 0 }">{{ nameLeft }}</span>
          </div>
          <input v-model="ocName" maxlength="20" class="oe-input" placeholder="给角色起个名字" />
        </div>
        <div class="oe-field">
          <div class="oe-label">
            <span>一句话简介</span>
            <span class="oe-count" :class="{ warn: bioLeft < 0 }">{{ bioLeft }}</span>
          </div>
          <input v-model="ocBio" maxlength="50" class="oe-input" placeholder="一句勾起好奇的话" />
        </div>
      </section>

      <!-- 分区 2：设定（含立绘 + 图片比例切换 + 上传） -->
      <section class="oe-section">
        <h2 class="oe-section-title">设定</h2>
        <div class="oe-field">
          <div class="oe-label">
            <span>世界观 / 设定</span>
            <span class="oe-count" :class="{ warn: worldLeft < 0 }">{{ worldLeft }}</span>
          </div>
          <input v-model="ocWorld" maxlength="60" class="oe-input" placeholder="TA 所处的世界或背景" />
        </div>

        <!-- 图片比例切换器（按用户决策：在上传图片前，以确认裁切规格。
             1:1 = 图片为正方形（渲染时占 3:4 卡片顶部，下方黑底补足）；
             3:4 = 图片充满整个 3:4 卡片） -->
        <div class="oe-field">
          <div class="oe-label"><span>图片规格</span></div>
          <div class="oe-aspect-row">
            <button
              class="oe-aspect-btn"
              :class="{ active: ocAspect === '3/4' }"
              @click="ocAspect = '3/4'"
            >
              <span class="oe-aspect-r rect-3-4"></span>
              <span>3 : 4（默认）</span>
            </button>
            <button
              class="oe-aspect-btn"
              :class="{ active: ocAspect === '1/1' }"
              @click="ocAspect = '1/1'"
            >
              <span class="oe-aspect-r rect-1-1"></span>
              <span>1 : 1</span>
            </button>
          </div>
        </div>

        <!-- 立绘上传组件 -->
        <div class="oe-field">
          <OcArtworkUploader
            v-model="ocIllust"
            :aspect="ocAspect"
            :user-id="userId"
            @error="onUploadError"
          />
        </div>
      </section>

      <!-- 分区 3：标签 -->
      <section class="oe-section">
        <div class="oe-section-head">
          <h2 class="oe-section-title">标签</h2>
          <span class="oe-section-sub">{{ ocTags.length }}/{{ TAG_MAX }}</span>
        </div>
        <div class="oe-tags">
          <span v-for="t in ocTags" :key="t" class="oe-tag">
            {{ t }}
            <button class="oe-tag-x" @click="removeTag(t)">×</button>
          </span>
          <span v-if="ocTags.length === 0" class="oe-tag-empty">还没有标签</span>
        </div>
        <div class="oe-tag-add">
          <input
            v-model="tagDraft"
            class="oe-input"
            placeholder="加个标签，回车确认"
            @keyup.enter="addTag"
            @keydown.backspace="!tagDraft && ocTags.length && ocTags.pop()"
          />
          <button class="oe-tag-add-btn" :disabled="ocTags.length >= TAG_MAX" @click="addTag">+</button>
        </div>
      </section>

      <!-- 分区 4：详细描述 -->
      <section class="oe-section">
        <h2 class="oe-section-title">详细描述</h2>
        <textarea
          v-model="ocDescText"
          class="oe-textarea"
          rows="6"
          placeholder="外貌、性格、故事、关系……越详细越有趣"
        />
      </section>

      <div class="oe-save-bar">
        <button class="oe-save-lg" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : '保存 OC 卡' }}
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.oe-root {
  min-height: 100vh;
  background: #f5f5f5;
  font-family: "Helvetica Neue", Arial, "Noto Sans JP", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.oe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #fff;
  border-bottom: 1px solid #ebebec;
  position: sticky;
  top: 0;
  z-index: 10;
}
.oe-title {
  font-size: 16px;
  font-weight: 700;
  color: #3c3c43;
  margin: 0;
  letter-spacing: 2.4px;
}
.oe-back {
  background: none;
  border: none;
  font-size: 14px;
  color: #3c3c43;
  cursor: pointer;
  padding: 4px 8px;
}
.oe-save {
  background: #6b8cae;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.oe-save:disabled { opacity: 0.5; }

.oe-loading {
  text-align: center;
  color: #76767b;
  padding: 60px 0;
  font-size: 14px;
}
.oe-error {
  background: #fff5f5;
  color: #c0392b;
  font-size: 13px;
  border: 1px solid #ebebec;
  border-radius: 4px;
  padding: 10px 14px;
  line-height: 1.6;
}

.oe-main {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
  margin: 0 auto;
}

.oe-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 4px;
}
.oe-preview-tip {
  font-size: 11px;
  color: #9d9da0;
  margin: 8px 0 0;
  text-align: center;
}

/* 分区卡片 (muji 风：白底 + 浅边框 + 4px 圆角) */
.oe-section {
  background: #fff;
  border: 1px solid #ebebec;
  border-radius: 4px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.oe-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.oe-section-title {
  font-size: 14px;
  font-weight: 700;
  color: #3c3c43;
  margin: 0;
  letter-spacing: 2.4px;
  line-height: 1.15;
}
.oe-section-sub {
  font-size: 12px;
  color: #76767b;
}

.oe-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.oe-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #6d6d72;
}
.oe-count {
  font-size: 11px;
  color: #9d9da0;
}
.oe-count.warn { color: #dd6b00; }

.oe-input,
.oe-textarea {
  border: 1px solid #d8d8d9;
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  color: #3c3c43;
  background: #fff;
  outline: none;
  transition: border-color 0.15s ease;
  width: 100%;
  font-family: inherit;
}
.oe-input:focus,
.oe-textarea:focus {
  border-color: #3c3c43;
}
.oe-textarea {
  resize: vertical;
  min-height: 100px;
}

/* 比例切换器 */
.oe-aspect-row {
  display: flex;
  gap: 8px;
}
.oe-aspect-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #d8d8d9;
  border-radius: 4px;
  background: #fff;
  color: #3c3c43;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.oe-aspect-btn:hover { background: #fafafa; }
.oe-aspect-btn.active {
  border-color: #6b8cae;
  background: #f4f7fa;
  color: #3c3c43;
  font-weight: 600;
}
.oe-aspect-r {
  display: inline-block;
  border: 1.5px solid currentColor;
  border-radius: 2px;
}
.rect-3-4 { width: 14px; height: 19px; }
.rect-1-1 { width: 16px; height: 16px; }

/* 标签 */
.oe-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 28px;
}
.oe-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f5f5f5;
  color: #3c3c43;
  font-size: 13px;
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #ebebec;
}
.oe-tag-x {
  background: none;
  border: none;
  color: #76767b;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.oe-tag-empty { font-size: 12px; color: #9d9da0; align-self: center; }
.oe-tag-add {
  display: flex;
  gap: 8px;
}
.oe-tag-add-btn {
  background: #6b8cae;
  color: #fff;
  border: none;
  border-radius: 4px;
  width: 42px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}
.oe-tag-add-btn:disabled { opacity: 0.4; }

.oe-save-bar { padding-top: 4px; }
.oe-save-lg {
  width: 100%;
  padding: 13px;
  border-radius: 4px;
  background: #6b8cae;
  color: #fff;
  border: none;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.oe-save-lg:disabled { opacity: 0.5; }
</style>