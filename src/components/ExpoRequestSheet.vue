<script setup lang="ts">
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useKizunaStore } from '../stores/kizuna'

const store = useKizunaStore()
const emit = defineEmits<{ (e: 'close'): void; (e: 'submitted'): void }>()

const form = ref({
  title: '',
  start_at: '',
  end_at: '',
  venue_name: '',
  venue_city: '',
  official_url: '',
  note: '',
})
const submitting = ref(false)
const errorMsg = ref('')
const success = ref(false)

const titleCap = computed(() => 50 - form.value.title.length)

function toISO(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}

async function submit() {
  if (!form.value.title.trim()) { errorMsg.value = '请填写漫展标题'; return }
  submitting.value = true
  errorMsg.value = ''
  try {
    const payload = {
      requester_id: store.currentUserId,
      title: form.value.title.trim(),
      start_at: toISO(form.value.start_at),
      end_at: toISO(form.value.end_at),
      venue_name: form.value.venue_name || null,
      venue_city: form.value.venue_city || null,
      official_url: form.value.official_url || null,
      note: form.value.note || null,
      status: 'pending',
    }
    const { error } = await supabase.from('expo_requests').insert(payload)
    if (error) throw error
    success.value = true
    emit('submitted')
    setTimeout(() => emit('close'), 1500)
  } catch (e: any) {
    console.error('[ExpoRequestSheet] submit failed', e)
    errorMsg.value = '提交失败：' + (e?.message || '未知错误')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="ers-overlay" @click.self="emit('close')">
      <div class="ers-sheet">
        <header class="ers-header">
          <button class="ers-cancel" @click="emit('close')">取消</button>
          <h2>找不到漫展？</h2>
          <span style="width: 40px"></span>
        </header>

        <div v-if="success" class="ers-success">
          已提交！运营审核通过后会自动出现在漫展列表
        </div>

        <template v-else>
          <div v-if="errorMsg" class="ers-error">{{ errorMsg }}</div>

          <div class="ers-body">
            <p class="ers-intro">填写你知道的信息，运营会审核后添加到漫展库</p>

            <label class="ers-field">
              <div class="ers-label"><span>漫展标题 *</span><span class="ers-cap">{{ titleCap }}/50</span></div>
              <input v-model="form.title" maxlength="50" class="ers-input" placeholder="如：2026 上海 Comicup" />
            </label>

            <div class="ers-row">
              <label class="ers-field">
                <div class="ers-label">开始时间</div>
                <input v-model="form.start_at" type="datetime-local" class="ers-input" />
              </label>
              <label class="ers-field">
                <div class="ers-label">结束时间</div>
                <input v-model="form.end_at" type="datetime-local" class="ers-input" />
              </label>
            </div>

            <div class="ers-row">
              <label class="ers-field">
                <div class="ers-label">场地名</div>
                <input v-model="form.venue_name" class="ers-input" placeholder="如：上海新国际博览中心" />
              </label>
              <label class="ers-field">
                <div class="ers-label">城市</div>
                <input v-model="form.venue_city" class="ers-input" placeholder="如：上海" />
              </label>
            </div>

            <label class="ers-field">
              <div class="ers-label">官网链接</div>
              <input v-model="form.official_url" class="ers-input" placeholder="https://…" />
            </label>

            <label class="ers-field">
              <div class="ers-label">补充说明</div>
              <textarea v-model="form.note" class="ers-input" rows="2" placeholder="如：官方微博、主办方信息等"></textarea>
            </label>

            <button class="ers-submit" :disabled="submitting" @click="submit">
              {{ submitting ? '提交中…' : '提交申请' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ers-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: flex-end; justify-content: center; }
.ers-sheet { background: #fff; width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; border-radius: 16px 16px 0 0; }
.ers-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #ebebec; position: sticky; top: 0; background: #fff; z-index: 2; }
.ers-header h2 { font-size: 16px; font-weight: 700; margin: 0; color: #3c3c43; letter-spacing: 2.4px; }
.ers-cancel { background: none; border: none; font-size: 14px; color: #6d6d72; cursor: pointer; }
.ers-error { background: #fff5f5; color: #c0392b; font-size: 13px; padding: 10px 18px; }
.ers-success { padding: 60px 24px; text-align: center; color: #2e7d32; font-size: 15px; font-weight: 600; }
.ers-body { padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 14px; }
.ers-intro { font-size: 13px; color: #6d6d72; padding: 10px 12px; background: #f5f5f5; border-radius: 4px; margin: 0; }
.ers-field { display: flex; flex-direction: column; gap: 6px; }
.ers-label { font-size: 12px; color: #6d6d72; display: flex; justify-content: space-between; }
.ers-cap { font-size: 11px; color: #9d9da0; }
.ers-input { border: 1px solid #d8d8d9; border-radius: 4px; padding: 10px 12px; font-size: 14px; color: #3c3c43; background: #fff; outline: none; font-family: inherit; }
.ers-input:focus { border-color: #3c3c43; }
.ers-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ers-submit { background: #6b8cae; color: #fff; border: none; border-radius: 4px; padding: 13px; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 4px; }
.ers-submit:disabled { opacity: 0.5; }
</style>