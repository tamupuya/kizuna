<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { supabase } from '../lib/supabase'

interface ExpoRow {
  id?: string
  title: string
  start_at: string
  end_at: string
  venue_id: string | null
  cover_url: string | null
  description: string
  official_url: string
  tags: string[]
  status: string
  source?: string
  review_status?: string
  owner_id?: string | null
}
interface VenueRow { id: string; name: string; city: string | null }

const props = defineProps<{
  initial: ExpoRow | null
  venues: VenueRow[]
  userId: string
  isOperator: boolean
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const form = ref<ExpoRow>({
  title: '',
  start_at: '',
  end_at: '',
  venue_id: null,
  cover_url: null,
  description: '',
  official_url: '',
  tags: [],
  status: 'upcoming',
})

const tagInput = ref('')
const saving = ref(false)
const errorMsg = ref('')

watch(() => props.initial, (v) => {
  if (v) {
    form.value = {
      ...v,
      start_at: v.start_at ? v.start_at.slice(0, 16) : '',
      end_at: v.end_at ? v.end_at.slice(0, 16) : '',
      tags: Array.isArray(v.tags) ? [...v.tags] : [],
    }
  } else {
    form.value = { title: '', start_at: '', end_at: '', venue_id: null, cover_url: null, description: '', official_url: '', tags: [], status: 'upcoming' }
  }
}, { immediate: true })

function toISO(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}

function addTag() {
  const t = tagInput.value.trim()
  if (!t || form.value.tags.length >= 10 || form.value.tags.includes(t)) return
  form.value.tags.push(t)
  tagInput.value = ''
}
function removeTag(t: string) {
  form.value.tags = form.value.tags.filter(x => x !== t)
}

async function save() {
  if (!form.value.title.trim()) { errorMsg.value = '请填写漫展标题'; return }
  if (!form.value.start_at || !form.value.end_at) { errorMsg.value = '请填写起止时间'; return }
  if (new Date(form.value.end_at) < new Date(form.value.start_at)) { errorMsg.value = '结束时间不能早于开始时间'; return }

  saving.value = true
  errorMsg.value = ''
  try {
    const payload: any = {
      title: form.value.title.trim(),
      start_at: toISO(form.value.start_at),
      end_at: toISO(form.value.end_at),
      venue_id: form.value.venue_id || null,
      cover_url: form.value.cover_url || null,
      description: form.value.description || null,
      official_url: form.value.official_url || null,
      tags: form.value.tags,
      status: form.value.status,
    }

    if (props.initial?.id) {
      // 编辑：商家改自家 / 运营改任何；改后重新进入 pending（除非运营直接改 approved 的）
      if (!props.isOperator) {
        payload.review_status = 'pending'
      }
      const { error } = await supabase.from('expos').update(payload).eq('id', props.initial.id)
      if (error) throw error
    } else {
      // 创建：商家提交默认 pending；运营创建默认 approved
      payload.source = props.isOperator ? 'manual' : 'merchant'
      payload.owner_id = props.userId
      payload.review_status = props.isOperator ? 'approved' : 'pending'
      const { error } = await supabase.from('expos').insert(payload)
      if (error) throw error
    }
    emit('saved')
  } catch (e: any) {
    console.error('[ExpoFormSheet] save failed', e)
    errorMsg.value = '保存失败：' + (e?.message || '未知错误')
  } finally {
    saving.value = false
  }
}

const titleCap = computed(() => 50 - form.value.title.length)
</script>

<template>
  <Teleport to="body">
    <div class="efs-overlay" @click.self="emit('close')">
      <div class="efs-sheet">
        <header class="efs-header">
          <button class="efs-cancel" @click="emit('close')">取消</button>
          <h2>{{ initial ? '编辑漫展' : '创建漫展' }}</h2>
          <button class="efs-save" :disabled="saving" @click="save">{{ saving ? '保存中' : '保存' }}</button>
        </header>

        <div v-if="errorMsg" class="efs-error">{{ errorMsg }}</div>

        <div class="efs-body">
          <label class="efs-field">
            <div class="efs-label"><span>漫展标题</span><span class="efs-cap">{{ titleCap }}/50</span></div>
            <input v-model="form.title" maxlength="50" class="efs-input" placeholder="如：2026 上海 Comicup" />
          </label>

          <div class="efs-row">
            <label class="efs-field">
              <div class="efs-label">开始时间</div>
              <input v-model="form.start_at" type="datetime-local" class="efs-input" />
            </label>
            <label class="efs-field">
              <div class="efs-label">结束时间</div>
              <input v-model="form.end_at" type="datetime-local" class="efs-input" />
            </label>
          </div>

          <label class="efs-field">
            <div class="efs-label">场地</div>
            <select v-model="form.venue_id" class="efs-input">
              <option :value="null">— 不选 —</option>
              <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}{{ v.city ? ' · ' + v.city : '' }}</option>
            </select>
          </label>

          <label class="efs-field">
            <div class="efs-label">封面 URL</div>
            <input v-model="form.cover_url" class="efs-input" placeholder="https://…" />
          </label>

          <label class="efs-field">
            <div class="efs-label">官网链接</div>
            <input v-model="form.official_url" class="efs-input" placeholder="https://…" />
          </label>

          <label class="efs-field">
            <div class="efs-label">描述</div>
            <textarea v-model="form.description" class="efs-input" rows="3" placeholder="简介、亮点、参展嘉宾…"></textarea>
          </label>

          <label class="efs-field">
            <div class="efs-label"><span>标签</span><span class="efs-cap">{{ form.tags.length }}/10</span></div>
            <div v-if="form.tags.length" class="efs-tags">
              <span v-for="t in form.tags" :key="t" class="efs-tag">{{ t }}<button @click="removeTag(t)">×</button></span>
            </div>
            <input v-model="tagInput" class="efs-input" placeholder="回车添加" @keydown.enter.prevent="addTag" />
          </label>

          <label class="efs-field">
            <div class="efs-label">状态</div>
            <select v-model="form.status" class="efs-input">
              <option value="upcoming">即将开始</option>
              <option value="ongoing">进行中</option>
              <option value="finished">已结束</option>
            </select>
          </label>

          <p v-if="!isOperator && initial" class="efs-hint">商家修改后漫展会重新进入待审核状态</p>
          <p v-if="!isOperator && !initial" class="efs-hint">商家创建的漫展需运营审核通过后才会在 App 显示</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.efs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: flex-end; justify-content: center; }
.efs-sheet { background: #fff; width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; border-radius: 16px 16px 0 0; }
.efs-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #ebebec; position: sticky; top: 0; background: #fff; z-index: 2; }
.efs-header h2 { font-size: 16px; font-weight: 700; margin: 0; color: #3c3c43; letter-spacing: 2.4px; }
.efs-cancel { background: none; border: none; font-size: 14px; color: #6d6d72; cursor: pointer; }
.efs-save { background: #6b8cae; color: #fff; border: none; border-radius: 4px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
.efs-save:disabled { opacity: 0.5; }
.efs-error { background: #fff5f5; color: #c0392b; font-size: 13px; padding: 10px 18px; }
.efs-body { padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 14px; }
.efs-field { display: flex; flex-direction: column; gap: 6px; }
.efs-label { font-size: 12px; color: #6d6d72; display: flex; justify-content: space-between; }
.efs-cap { font-size: 11px; color: #9d9da0; }
.efs-input { border: 1px solid #d8d8d9; border-radius: 4px; padding: 10px 12px; font-size: 14px; color: #3c3c43; background: #fff; outline: none; font-family: inherit; }
.efs-input:focus { border-color: #3c3c43; }
.efs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.efs-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.efs-tag { background: #f5f5f5; border: 1px solid #ebebec; border-radius: 4px; padding: 4px 10px; font-size: 13px; color: #3c3c43; display: inline-flex; align-items: center; gap: 4px; }
.efs-tag button { background: none; border: none; color: #76767b; cursor: pointer; font-size: 14px; line-height: 1; }
.efs-hint { font-size: 12px; color: #d97706; padding: 8px 12px; background: #fff7e6; border-radius: 4px; }
</style>