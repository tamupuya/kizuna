<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { supabase } from '../lib/supabase'
import ExpoFormSheet from '../components/ExpoFormSheet.vue'

const router = useRouter()
const store = useKizunaStore()

interface ExpoRow {
  id: string
  title: string
  start_at: string
  end_at: string
  venue_id: string | null
  status: string
  source: string
  review_status: string
  owner_id: string | null
  cover_url: string | null
  reject_reason?: string | null
}
interface VenueRow { id: string; name: string; city: string | null }

const me = computed(() => store.currentUser as any)
const myRole = computed(() => me.value?.role || 'user')
const canView = computed(() => ['merchant', 'operator', 'admin'].includes(myRole.value))
const isOperator = computed(() => ['operator', 'admin'].includes(myRole.value))

const tab = ref<'mine' | 'all' | 'pending'>(isOperator.value ? 'pending' : 'mine')
const list = ref<ExpoRow[]>([])
const venues = ref<VenueRow[]>([])
const loading = ref(false)
const errorMsg = ref('')

const editing = ref<ExpoRow | null>(null)
const showForm = ref(false)

async function load() {
  if (!canView.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const { data: v } = await supabase.from('venues').select('id,name,city').order('name')
    venues.value = (v as VenueRow[]) || []

    let q = supabase.from('expos').select('*').order('start_at', { ascending: false })
    if (!isOperator.value) {
      q = q.eq('owner_id', store.currentUserId)
    }
    const { data, error } = await q
    if (error) throw error
    list.value = (data as ExpoRow[]) || []
  } catch (e: any) {
    console.error('[MerchantConsole] load failed', e)
    errorMsg.value = '加载失败：' + (e?.message || '未知错误')
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  if (tab.value === 'pending') return list.value.filter(e => e.review_status === 'pending')
  if (tab.value === 'mine') return list.value.filter(e => e.owner_id === store.currentUserId)
  return list.value
})

function openCreate() {
  editing.value = null
  showForm.value = true
}
function openEdit(row: ExpoRow) {
  editing.value = row
  showForm.value = true
}

async function review(row: ExpoRow, action: 'approved' | 'rejected', reason?: string) {
  try {
    const patch: any = {
      review_status: action,
      reviewed_by: store.currentUserId,
      reviewed_at: new Date().toISOString(),
    }
    if (action === 'rejected') patch.reject_reason = reason || ''
    const { error } = await supabase.from('expos').update(patch).eq('id', row.id)
    if (error) throw error
    await load()
  } catch (e: any) {
    errorMsg.value = '审核失败：' + (e?.message || '')
  }
}

async function rejectWithReason(row: ExpoRow) {
  const reason = window.prompt('拒绝原因（可选）')
  if (reason === null) return
  await review(row, 'rejected', reason || undefined)
}

function fmtDate(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const statusBadge = (s: string) => ({
  approved: { text: '已通过', cls: 'badge-approved' },
  pending: { text: '待审', cls: 'badge-pending' },
  rejected: { text: '已拒绝', cls: 'badge-rejected' },
}[s] || { text: s, cls: '' })

onMounted(() => {
  if (!canView.value) {
    router.push('/profile')
    return
  }
  load()
})
</script>

<template>
  <div class="mc-root">
    <header class="mc-header">
      <button class="mc-back" @click="router.push('/profile')">‹ 返回</button>
      <h1 class="mc-title">{{ isOperator ? '漫展管理台' : '我的漫展' }}</h1>
      <button class="mc-create" @click="openCreate">+ 创建</button>
    </header>

    <div v-if="errorMsg" class="mc-error">{{ errorMsg }}</div>

    <nav v-if="canView" class="mc-tabs">
      <button v-if="isOperator" :class="{active: tab==='pending'}" @click="tab='pending'">待审 ({{ list.filter(e=>e.review_status==='pending').length }})</button>
      <button :class="{active: tab==='mine'}" @click="tab='mine'">我的 ({{ list.filter(e=>e.owner_id===store.currentUserId).length }})</button>
      <button v-if="isOperator" :class="{active: tab==='all'}" @click="tab='all'">全部 ({{ list.length }})</button>
    </nav>

    <div v-if="loading" class="mc-empty">加载中…</div>
    <div v-else-if="!filtered.length" class="mc-empty">暂无漫展</div>

    <ul v-else class="mc-list">
      <li v-for="row in filtered" :key="row.id" class="mc-row">
        <div class="mc-row-main">
          <div class="mc-row-title">{{ row.title }}</div>
          <div class="mc-row-meta">
            <span>{{ fmtDate(row.start_at) }} - {{ fmtDate(row.end_at) }}</span>
            <span :class="statusBadge(row.review_status).cls">{{ statusBadge(row.review_status).text }}</span>
            <span class="mc-source">{{ row.source }}</span>
          </div>
          <div v-if="row.review_status==='rejected' && row.reject_reason" class="mc-reject-reason">拒绝原因：{{ row.reject_reason }}</div>
        </div>
        <div class="mc-row-actions">
          <button v-if="row.owner_id===store.currentUserId || isOperator" @click="openEdit(row)">编辑</button>
          <button v-if="isOperator && row.review_status==='pending'" class="mc-approve" @click="review(row, 'approved')">通过</button>
          <button v-if="isOperator && row.review_status==='pending'" class="mc-reject" @click="rejectWithReason(row)">拒绝</button>
        </div>
      </li>
    </ul>

    <ExpoFormSheet v-if="showForm" :initial="editing" :venues="venues" :user-id="store.currentUserId || ''" :is-operator="isOperator"
      @close="showForm = false" @saved="showForm = false; load()" />
  </div>
</template>

<style scoped>
.mc-root { min-height: 100vh; background: #f5f5f5; font-family: "Helvetica Neue", Arial, "PingFang SC", sans-serif; }
.mc-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #fff; border-bottom: 1px solid #ebebec; position: sticky; top: 0; z-index: 10; }
.mc-title { font-size: 16px; font-weight: 700; color: #3c3c43; margin: 0; letter-spacing: 2.4px; }
.mc-back { background: none; border: none; font-size: 14px; color: #3c3c43; cursor: pointer; padding: 4px 8px; }
.mc-create { background: #6b8cae; color: #fff; border: none; border-radius: 4px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
.mc-error { background: #fff5f5; color: #c0392b; font-size: 13px; padding: 10px 14px; border-bottom: 1px solid #ebebec; }
.mc-tabs { display: flex; gap: 8px; padding: 12px 18px; background: #fff; border-bottom: 1px solid #ebebec; }
.mc-tabs button { flex: 1; padding: 8px; border: 1px solid #d8d8d9; background: #fff; color: #3c3c43; border-radius: 4px; cursor: pointer; font-size: 13px; }
.mc-tabs button.active { border-color: #6b8cae; background: #f4f7fa; font-weight: 600; }
.mc-empty { padding: 60px 0; text-align: center; color: #76767b; font-size: 14px; }
.mc-list { list-style: none; margin: 0; padding: 12px 18px; }
.mc-row { background: #fff; border: 1px solid #ebebec; border-radius: 4px; padding: 14px; margin-bottom: 8px; display: flex; gap: 12px; align-items: flex-start; }
.mc-row-main { flex: 1; min-width: 0; }
.mc-row-title { font-size: 15px; font-weight: 700; color: #3c3c43; margin-bottom: 6px; }
.mc-row-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: #6d6d72; flex-wrap: wrap; }
.mc-source { color: #9d9da0; font-size: 11px; }
.mc-reject-reason { margin-top: 6px; font-size: 12px; color: #c0392b; }
.badge-approved { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
.badge-pending { background: #fff7e6; color: #d97706; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
.badge-rejected { background: #fceaea; color: #c0392b; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
.mc-row-actions { display: flex; flex-direction: column; gap: 6px; }
.mc-row-actions button { padding: 5px 10px; border: 1px solid #d8d8d9; background: #fff; color: #3c3c43; border-radius: 4px; cursor: pointer; font-size: 12px; }
.mc-row-actions button:hover { background: #f5f5f5; }
.mc-approve { background: #2e7d32 !important; color: #fff !important; border-color: #2e7d32 !important; }
.mc-reject { background: #c0392b !important; color: #fff !important; border-color: #c0392b !important; }
</style>