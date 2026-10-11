<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import IdentityPicker from '../components/IdentityPicker.vue'
import InterestBuilder, { type InterestCategory } from '../components/InterestBuilder.vue'
import MbtiPicker from '../components/MbtiPicker.vue'
import ZodiacPicker from '../components/ZodiacPicker.vue'
import CodeField from '../components/CodeField.vue'
import { useDebouncedInterestSync } from '../composables/useDebouncedInterestSync'
import { generateCode, normalizeCode, isValidCode } from '../lib/codeGenerator'
import { useAlertStore } from '../stores/alert'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const router = useRouter()
const store = useKizunaStore()
const alertStore = useAlertStore()

const cn = ref('')
const gender = ref<'male' | 'female' | 'private'>('private')
const activityArea = ref('')
const identityTags = ref<string[]>([])
const interestCategories = ref<InterestCategory[]>([])
const mbti = ref<string | null>(null)
const zodiac = ref<string | null>(null)
const code = ref<string>('')
const bio = ref<string>('')  // v0.9.10.8：签名（≤50 字）
const avatarUrl = ref<string>('')  // v0.9.23：头像 URL（已上传的远程地址）
const avatarUploading = ref(false)  // 头像上传中
const avatarInput = ref<HTMLInputElement | null>(null)  // 隐藏的 file input

function pickAvatar() { avatarInput.value?.click() }

async function onAvatarPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alertStore.warn('头像最大 5MB', '', 2500)
    input.value = ''
    return
  }
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
    alertStore.warn('仅支持 PNG/JPG/WEBP/GIF', '', 2500)
    input.value = ''
    return
  }
  if (!isSupabaseConfigured() || !store.currentUserId) {
    // 未配置：base64 本地预览（不持久化到后端）
    const reader = new FileReader()
    reader.onload = () => { avatarUrl.value = String(reader.result) }
    reader.readAsDataURL(file)
    input.value = ''
    return
  }
  avatarUploading.value = true
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${store.currentUserId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('kizuna-avatars').upload(path, file, { cacheControl: '3600', upsert: true })
    if (upErr) {
      alertStore.warn('上传失败：' + (upErr.message || '未知错误'), '', 3000)
      input.value = ''
      return
    }
    const { data: pub } = supabase.storage.from('kizuna-avatars').getPublicUrl(path)
    avatarUrl.value = pub.publicUrl
    // 立即写入 users.avatar_url
    await store.updateUser(store.currentUserId, { avatar_url: pub.publicUrl } as any)
  } catch (err: any) {
    alertStore.warn('上传出错：' + (err?.message || ''), '', 3000)
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

function extractNgTags(): string[] {
  const ngCat = interestCategories.value.find(c => c.name === '避雷 (NG)')
  return ngCat ? [...ngCat.works] : []
}

const { sync: debouncedSync } = useDebouncedInterestSync(
  async (val: InterestCategory[]) => {
    if (!store.currentUserId) return
    const ngCat = val.find(c => c.name === '避雷 (NG)')
    await store.updateUser(store.currentUserId, {
      interest_categories: val,
      interest_tags: val.flatMap(c => [c.name, ...c.works]),
      ng_tags: ngCat ? [...ngCat.works] : [],
    } as any)
  },
  600
)

/** v0.9.10.8：签名超 50 字提示并截断 */
function onBioInput() {
  if (bio.value.length > 50) {
    alertStore.warn('签名最多 50 字', '', 2500)
    bio.value = bio.value.slice(0, 50)
  }
}

watch(interestCategories, (val) => debouncedSync(val), { deep: true })

const saving = ref(false)
const isCreating = ref(false)

const genderOptions = [
  { value: 'male' as const, label: '男' },
  { value: 'female' as const, label: '女' },
  { value: 'private' as const, label: '保密' },
]

const identityPresets = [
  'Coser', '妆娘', '毛娘', '后期', '道具师', '裁缝', '版师', '手工娘', 'CV', '唱见', '舞见', '同人', '画师',
  '学生', '社畜', '是阿宅喵'
]

function extractMbti(intentWant: string[] | undefined): string | null {
  if (!intentWant) return null
  const m = intentWant.find((s) => s.startsWith('mbti:'))
  return m ? m.slice(5) : null
}

onMounted(async () => {
  try {
    if (store.users.length === 0) await store.fetchUsers()
    if (store.currentUser) {
    cn.value = store.currentUser.cn
    gender.value = store.currentUser.gender as any
    identityTags.value = [...(store.currentUser.identity_tags || [])]
    
    const existingCats = store.currentUser.interest_categories
      ? store.currentUser.interest_categories.map(c => ({ name: c.name, works: [...c.works], state: c.state }))
      : []
    
    // 数据迁移：老用户 ng_tags → NG 分类
    const oldNgTags = (store.currentUser as any).ng_tags as string[] | undefined
    const hasNgCat = existingCats.some(c => c.name === '避雷 (NG)')
    if (oldNgTags && oldNgTags.length > 0 && !hasNgCat) {
      existingCats.push({ name: '避雷 (NG)', works: [...oldNgTags] })
    }
    interestCategories.value = existingCats

    activityArea.value = store.currentUser.activity_area || ''
    mbti.value = (store.currentUser as any).mbti || extractMbti(store.currentUser.intent_want)
    zodiac.value = (store.currentUser as any).zodiac || null
    code.value = (store.currentUser as any).code || generateCode(true)
    bio.value = (store.currentUser as any).bio || ''
    avatarUrl.value = (store.currentUser as any).avatar_url || ''
    isCreating.value = false
  } else {
    isCreating.value = true
  }
  } catch (e) {
    console.error('[EditorView] load user failed:', e)
    isCreating.value = true
  }
})

async function save() {
  if (!cn.value.trim()) {
    alertStore.warn('请填写 CN / 昵称')
    return
  }

  const finalCode = code.value.trim() ? normalizeCode(code.value) : generateCode(true)
  if (!isValidCode(finalCode)) {
    alertStore.warn('编号必须是 6 位 0-9/A-Z')
    return
  }

  saving.value = true
  try {
    // ===== 核心：保存所有 state=B/C 的 cat（A 态不保存，用户未碰过）=====
    // NG 分类例外：无论什么状态都保存
    const catsToSave = interestCategories.value
      .filter(c => c.state !== 'A' || c.name === '避雷 (NG)')
      .map(c => ({ ...c, works: [...c.works] }))

    const intentWant: string[] = []

    if (isCreating.value) {
      const result = await store.createUser({
        cn: cn.value.trim(),
        avatar_url: avatarUrl.value || '',  // v0.9.23.4：未上传时为空 → 前端 fallback 小猫默认头像
        bio: bio.value.slice(0, 50),
        gender: gender.value,
        identity_tags: identityTags.value,
        interest_tags: catsToSave.flatMap(c => [c.name, ...c.works]),
        interest_categories: catsToSave,
        intent_want: intentWant,
        mbti: mbti.value,
        intent_provide: [],
        activity_area: activityArea.value.trim(),
        zodiac: zodiac.value,
        code: finalCode,
        ng_tags: extractNgTags(),
      } as any)

      if (!result) {
        alertStore.warn('创建失败：' + (store.error || '未知错误'))
        saving.value = false
        return
      }
    } else {
      const oldIntent = (store.currentUser?.intent_want || []).filter((s) => !s.startsWith('mbti:'))

      // MBTI 改用独立字段存储，不再混入 intent_want
      const newIntentWant = oldIntent

      // merge：防止手风琴收起后丢失
      const current = interestCategories.value.map(c => ({ ...c, works: [...c.works], state: c.state }))
      const old = (store.currentUser?.interest_categories || []) as InterestCategory[]
      const merged: InterestCategory[] = [...current]
      old.forEach(o => {
        if (!merged.find(c => c.name === o.name)) {
          merged.push({ name: o.name, works: [...o.works], state: o.state })
        }
      })
      
      // 排除 A 态（用户未碰过），NG 例外
      const catsToSave = merged.filter(c => c.state !== 'A' || c.name === '避雷 (NG)')

      const ok = await store.updateUser(store.currentUserId!, {
        cn: cn.value.trim(),
        bio: bio.value.slice(0, 50),
        gender: gender.value,
        activity_area: activityArea.value.trim(),
        identity_tags: identityTags.value,
        interest_categories: catsToSave,
        interest_tags: catsToSave.flatMap(c => [c.name, ...c.works]),
        intent_want: newIntentWant,
        mbti: mbti.value,
        zodiac: zodiac.value,
        code: finalCode,
        ng_tags: extractNgTags(),
        updated_at: new Date().toISOString(),
      } as any)

      if (!ok) {
        alertStore.warn('保存失败：' + (store.error || '未知错误'))
        saving.value = false
        return
      }
    }

    router.push('/profile')
  } catch (err: any) {
    console.error('Save failed:', err)
    alertStore.warn('保存失败: ' + err.message)
  }
  saving.value = false
}
</script>

<template>
  <div class="editor-page">
    <div class="editor-shell">
      <div class="editor-top">
        <button @click="router.back()" class="editor-back">←</button>
        <h1 class="editor-title">{{ isCreating ? '创建人设卡' : '编辑人设卡' }}</h1>
        <div style="width: 24px"></div>
      </div>

      <div class="editor-card editor-card-airbnb">
        <h2 class="card-title">基本资料</h2>
        <!-- v0.9.23：头像上传 -->
        <div class="avatar-row">
          <div class="avatar-preview" :class="{ 'avatar-placeholder': !avatarUrl }" @click="pickAvatar">
            <img v-if="avatarUrl" :src="avatarUrl" alt="头像" class="avatar-img" />
            <span v-else class="avatar-placeholder-icon">+</span>
            <div v-if="avatarUploading" class="avatar-loading">上传中...</div>
          </div>
          <div class="avatar-info">
            <div class="avatar-title">头像</div>
            <div class="avatar-desc">点击上传</div>
          </div>
          <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="avatar-hidden-input" @change="onAvatarPicked" />
        </div>
        <!-- Row 1: 昵称 + 编号（v0.9.10.8：CN/昵称合并为一个可编辑整体） -->
        <div class="ab-grid">
          <div class="ab-cell">
            <label class="ab-label">CN / 昵称</label>
            <input v-model="cn" type="text" maxlength="20" class="ab-input" placeholder="CN/昵称" />
          </div>
          <div class="ab-cell">
            <label class="ab-label">编号</label>
            <CodeField v-model="code" :cn="cn" :users="store.users" :self-id="store.currentUserId || undefined" />
          </div>
        </div>
        <!-- Row 2: 性别 + 活动地区 -->
        <div class="ab-grid">
          <div class="ab-cell">
            <label class="ab-label">性别</label>
            <div class="ab-gender-row">
              <button
                v-for="opt in genderOptions"
                :key="opt.value"
                @click="gender = opt.value"
                class="ab-gender-pill"
                :class="{ 'ab-gender-pill-active': gender === opt.value }"
              >{{ opt.label }}</button>
            </div>
          </div>
          <div class="ab-cell">
            <label class="ab-label">活动地区</label>
            <input v-model="activityArea" type="text" maxlength="30" class="ab-input" placeholder="" />
          </div>
        </div>
        <!-- Row 3: MBTI + 星座 -->
        <div class="ab-grid">
          <div class="ab-cell">
            <label class="ab-label">MBTI</label>
            <MbtiPicker v-model="mbti" />
          </div>
          <div class="ab-cell">
            <label class="ab-label">星座</label>
            <ZodiacPicker v-model="zodiac" />
          </div>
        </div>
        <!-- Row 4: 签名（通栏，v0.9.10.8 新加） -->
        <div class="ab-grid ab-grid-single">
          <div class="ab-cell">
            <label class="ab-label">签名</label>
            <input
              v-model="bio"
              type="text"
              maxlength="50"
              class="ab-input"
              placeholder="一句话介绍你自己"
              @input="onBioInput"
            />
          </div>
        </div>
      </div>

      <div class="editor-card">
        <h2 class="card-title">身份</h2>
        <IdentityPicker v-model="identityTags" :presets="identityPresets" :max-count="3" title="选择身份">
          <div class="picker-trigger">
            <span v-if="identityTags.length === 0" class="text-stone-400">点击选择身份</span>
            <div v-else class="flex flex-wrap gap-1.5">
              <span v-for="tag in identityTags" :key="tag" class="picker-tag">{{ tag }}</span>
            </div>
          </div>
        </IdentityPicker>
        <p class="text-xs text-stone-400 mt-2">身份最多 3 个</p>
      </div>

      <div class="editor-card">
        <h2 class="card-title">兴趣图鉴</h2>
        <p class="text-sm text-stone-500 mb-3">点 chip 直接加，每分类作品 ≤3 个，NG ≤10</p>
        <InterestBuilder v-model="interestCategories" />
      </div>

      <button @click="save" :disabled="saving" class="editor-save-btn">
        {{ saving ? '保存中...' : (isCreating ? '创建' : '保存') }}
      </button>
      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.editor-page { min-height: 100vh; background: #f5f1e8; padding: 20px; }
.editor-shell { max-width: 420px; margin: 0 auto; }
.editor-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.editor-back { background: none; border: none; font-size: 22px; color: #2b2a26; cursor: pointer; padding: 4px; }
.editor-title { font-size: 20px; font-weight: 700; color: #2b2a26; }
.editor-card { background: #ffffff; border-radius: 14px; padding: 18px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); border: 1px solid #f0ede5; }
.card-title { font-size: 17px; font-weight: 700; color: #2b2a26; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #f0ede5; }

/* v0.9.23：头像上传 */
.avatar-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.avatar-preview { position: relative; width: 60px; height: 60px; border-radius: 50%; overflow: hidden; cursor: pointer; border: 1px solid #dddddd; background: #2b2a26; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s ease; }
.avatar-preview:hover { border-color: #222222; }
.avatar-placeholder { background: #2b2a26; color: #fff5dc; }
.avatar-placeholder-icon { font-size: 28px; line-height: 1; font-weight: 300; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.avatar-loading { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.avatar-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.avatar-title { font-size: 14px; font-weight: 600; color: #2b2a26; }
.avatar-desc { font-size: 12px; color: #717171; }
.avatar-hidden-input { display: none; }
.picker-trigger { padding: 10px 14px; border: 1px solid #e8e6e1; border-radius: 8px; background: #fafaf8; min-height: 42px; display: flex; align-items: center; font-size: 14px; }
.picker-tag { background: #f4f0e8; color: #5c4d2e; padding: 3px 10px; border-radius: 12px; font-size: 13px; }
.editor-save-btn { width: 100%; padding: 14px; border-radius: 12px; background: #2b2a26; color: #fff5dc; font-size: 16px; font-weight: 600; border: none; cursor: pointer; margin-top: 8px; }
.editor-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.safe-bottom { height: 24px; }

.editor-card-airbnb { background: #ffffff; border-radius: 16px; padding: 20px 18px 18px; border: 1px solid #ebebeb; }
.ab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.ab-grid:last-child { margin-bottom: 0; }
.ab-grid-single { grid-template-columns: 1fr; }
.ab-cell { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ab-label { font-size: 12px; font-weight: 600; color: #717171; letter-spacing: 0.02em; padding-left: 2px; }
.ab-input { width: 100%; height: 48px; padding: 0 14px; border: 1px solid #dddddd; border-radius: 10px; background: #f7f7f7; font-size: 15px; color: #222222; font-weight: 500; outline: none; box-sizing: border-box; }
.ab-input::placeholder { color: #b0b0b0; font-weight: 400; }
.ab-input:focus { border-color: #222222; background: #ffffff; }
.ab-gender-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; height: 48px; }
.ab-gender-pill { display: flex; align-items: center; justify-content: center; border: 1px solid #dddddd; border-radius: 10px; background: #f7f7f7; color: #717171; font-size: 14px; font-weight: 500; cursor: pointer; padding: 0; }
.ab-gender-pill:hover:not(.ab-gender-pill-active) { border-color: #222222; color: #222222; }
.ab-gender-pill-active { background: #222222; border-color: #222222; color: #ffffff; font-weight: 600; }
</style>