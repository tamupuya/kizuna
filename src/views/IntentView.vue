<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { supabase } from '../lib/supabase'
import { useAlertStore } from '../stores/alert'

const router = useRouter()
const store = useKizunaStore()
const alert = useAlertStore()
const saving = ref(false)

// Three sections
const wantMeet = ref<string[]>([])   // 想认识的人
const wantDo = ref<string[]>([])     // 想一起做的事
const provide = ref<string[]>([])    // 我能提供

const newWantMeet = ref('')
const newWantDo = ref('')
const newProvide = ref('')

// Presets
const wantMeetPresets = ['同担', 'OC 友', '后期', 'coser', '画师', '谷子囤积', '打游戏', '深渊玩家', '同CP', '看番', '集邮']

const wantDoPresets = ['约稿', '谷子互换', '逛展', '一起拍照', '拼团', '打游戏', '深渊互助', '漫展面基', 'cos 互助', '手办开箱']

const providePresets = ['约稿', '插画', '后期', '翻译', 'cos 道具借用', '模型工具借用', '谷子互换', '开荒陪玩', '技术指导', '拍照修图', '开荒陪练']

onMounted(() => {
  if (store.currentUser) {
    const u = store.currentUser as any
    wantMeet.value = [...(u.intent_want_meet || [])]
    wantDo.value = [...(u.intent_want_do || u.intent_want || [])]
    provide.value = [...(u.intent_provide || [])]
  }
})

function toggle(arr: any, tag: string) {
  const idx = arr.value.indexOf(tag)
  if (idx >= 0) arr.value.splice(idx, 1)
  else arr.value.push(tag)
}

function addCustom(arr: any, source: any) {
  const tag = source.value.trim()
  if (tag && !arr.value.includes(tag)) arr.value.push(tag)
  source.value = ''
}

function removeTag(arr: any, tag: string) {
  const idx = arr.value.indexOf(tag)
  if (idx >= 0) arr.value.splice(idx, 1)
}

async function save() {
  saving.value = true
  try {
    const { error } = await supabase
      .from('users')
      .update({
        intent_want_meet: wantMeet.value,
        intent_want_do: wantDo.value,
        intent_provide: provide.value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', store.currentUserId)

    if (error) throw error
    await store.fetchUsers()
    router.push('/profile')
  } catch (err: any) {
    console.error('Save failed:', err)
    alert.error('保存失败', err.message)
  }
  saving.value = false
}
</script>

<template>
  <div class="intent-page">
    <div class="intent-shell">
      <div class="top-bar">
        <button @click="router.back()" class="back-btn">←</button>
        <h1 class="page-title-sm">我的意图</h1>
        <div style="width: 24px"></div>
      </div>

      <!-- Section 1: 想认识的人 -->
      <div class="intent-card">
        <div class="section-header">
          <h2 class="section-title">想认识的人</h2>
        </div>
        <p class="section-desc">你想找什么样的同好</p>

        <div class="chip-grid">
          <button
            v-for="tag in wantMeetPresets"
            :key="tag"
            @click="toggle(wantMeet, tag)"
            class="chip"
            :class="{ 'chip-active': wantMeet.includes(tag) }"
          >
            {{ tag }}
          </button>
        </div>

        <div class="custom-list">
          <span
            v-for="tag in wantMeet.filter(t => !wantMeetPresets.includes(t))"
            :key="tag"
            class="chip-custom"
          >
            {{ tag }}
            <button @click="removeTag(wantMeet, tag)" class="chip-remove">×</button>
          </span>
        </div>

        <div class="add-input-row">
          <input
            v-model="newWantMeet"
            type="text"
            maxlength="10"
            class="add-input"
            placeholder="自定义"
            @keyup.enter="addCustom(wantMeet, newWantMeet)"
          />
          <button @click="addCustom(wantMeet, newWantMeet)" class="add-input-btn">+</button>
        </div>
      </div>

      <!-- Section 2: 想一起做的事 -->
      <div class="intent-card">
        <div class="section-header">
          <h2 class="section-title">想一起做的事</h2>
        </div>
        <p class="section-desc">想和同好一起做的事</p>

        <div class="chip-grid">
          <button
            v-for="tag in wantDoPresets"
            :key="tag"
            @click="toggle(wantDo, tag)"
            class="chip"
            :class="{ 'chip-active': wantDo.includes(tag) }"
          >
            {{ tag }}
          </button>
        </div>

        <div class="custom-list">
          <span
            v-for="tag in wantDo.filter(t => !wantDoPresets.includes(t))"
            :key="tag"
            class="chip-custom"
          >
            {{ tag }}
            <button @click="removeTag(wantDo, tag)" class="chip-remove">×</button>
          </span>
        </div>

        <div class="add-input-row">
          <input
            v-model="newWantDo"
            type="text"
            maxlength="10"
            class="add-input"
            placeholder="自定义"
            @keyup.enter="addCustom(wantDo, newWantDo)"
          />
          <button @click="addCustom(wantDo, newWantDo)" class="add-input-btn">+</button>
        </div>
      </div>

      <!-- Section 3: 我能提供 -->
      <div class="intent-card">
        <div class="section-header">
          <h2 class="section-title">我能提供</h2>
        </div>
        <p class="section-desc">有什么你想做的</p>

        <div class="chip-grid">
          <button
            v-for="tag in providePresets"
            :key="tag"
            @click="toggle(provide, tag)"
            class="chip"
            :class="{ 'chip-active': provide.includes(tag) }"
          >
            {{ tag }}
          </button>
        </div>

        <div class="custom-list">
          <span
            v-for="tag in provide.filter(t => !providePresets.includes(t))"
            :key="tag"
            class="chip-custom"
          >
            {{ tag }}
            <button @click="removeTag(provide, tag)" class="chip-remove">×</button>
          </span>
        </div>

        <div class="add-input-row">
          <input
            v-model="newProvide"
            type="text"
            maxlength="10"
            class="add-input"
            placeholder="自定义"
            @keyup.enter="addCustom(provide, newProvide)"
          />
          <button @click="addCustom(provide, newProvide)" class="add-input-btn">+</button>
        </div>
      </div>

      <button
        @click="save"
        :disabled="saving"
        class="save-btn"
      >
        {{ saving ? '保存中...' : '保存' }}
      </button>

      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.intent-page {
  min-height: 100vh;
  background: #f5f1e8;
  padding: 20px;
}

.intent-shell {
  max-width: 420px;
  margin: 0 auto;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.back-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.page-title-sm {
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
}

.intent-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 14px;
  border: 1px solid #f0ede5;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section-icon {
  font-size: 18px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #2b2a26;
}

.section-desc {
  font-size: 12px;
  color: #a8a39a;
  margin-bottom: 14px;
}

.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.chip {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid #e8e6e1;
  background: #ffffff;
  color: #5c5953;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.chip:hover {
  border-color: #b8ad95;
}

.chip-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

.custom-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.chip-custom {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px dashed #b8ad95;
  background: #fff5dc;
  color: #5c4d2e;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chip-remove {
  background: none;
  border: none;
  color: #a8a39a;
  font-size: 14px;
  cursor: pointer;
  padding: 0 0 0 2px;
}

.chip-remove:hover {
  color: #5c4d2e;
}

.add-input-row {
  display: flex;
  gap: 6px;
}

.add-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 13px;
  outline: none;
}

.add-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.add-input-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 18px;
  font-weight: 300;
  border: none;
  cursor: pointer;
}

.add-input-btn:hover {
  background: #3a3528;
}

.save-btn {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-top: 8px;
}

.save-btn:disabled {
  opacity: 0.5;
}

.safe-bottom {
  height: 24px;
}
</style>