<script setup lang="ts">
// 漫展详情页（v3）：想去 / 在场确认
// 2026-08-09: P0-A 雷达精进

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useVenuePresence, TIME_SLOT_LABEL, WISHLIST_LIMIT, type TimeSlot } from '@/lib/venue'
import type { Expo } from '@/lib/mockData'
import { useAlertStore } from '../stores/alert'

const route = useRoute()
const router = useRouter()
const alertStore = useAlertStore()

const expoId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})
const expo = ref<Expo | null>(null)
const showOnsiteSheet = ref(false)
const selectedDate = ref<string>('')
const selectedTimeSlot = ref<TimeSlot>('all_day')
const currentUserId = ref<string>('')

const presence = useVenuePresence()

// 从 sessionStorage / supabase 拿当前用户 ID
function loadCurrentUser() {
  try {
    const uid = localStorage.getItem('kizuna.uid') || ''
    currentUserId.value = uid
    if (uid) presence.loadMyPresences(uid)
  } catch (e) {}
}

// 从 expo 列表中找（mock fallback）
async function loadExpo() {
  try {
    // mock 优先
    const { mockExpos } = await import('@/lib/mockData')
    const found = mockExpos.find(e => e.id === expoId.value)
    if (found) {
      expo.value = found
      return
    }
    // Supabase fallback
    const { supabase, isSupabaseConfigured } = await import('@/lib/supabase')
    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from('expos')
        .select('*')
        .eq('id', expoId.value)
        .maybeSingle()
      if (data) expo.value = data as Expo
    }
  } catch (e) {
    console.error('[ExpoDetailView] loadExpo failed:', e)
  }
}

const myPresence = computed(() => {
  if (!currentUserId.value || !expo.value) return undefined
  return presence.getPresence(currentUserId.value, expo.value.id)
})

const myWishlistCount = computed(() =>
  presence.presences.value.filter(
    p => p.user_id === currentUserId.value && p.status === 'wishlist'
  ).length
)

const canWishlist = computed(() =>
  myPresence.value?.status !== 'wishlist' &&
  myPresence.value?.status !== 'onsite' &&
  myWishlistCount.value < WISHLIST_LIMIT
)

// 在场日期选项：开场前 1 个月到当天
const onsiteDateOptions = computed(() => {
  if (!expo.value) return []
  const start = new Date(expo.value.start_at)
  const end = new Date(expo.value.end_at)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return []
  const earliest = new Date(start)
  earliest.setMonth(earliest.getMonth() - 1)

  const options: { value: string; label: string }[] = []
  const cur = new Date(earliest)
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10)
    const label = `${cur.getMonth() + 1}/${cur.getDate()}`
    options.push({ value: dateStr, label })
    cur.setDate(cur.getDate() + 1)
  }
  return options
})

async function handleWishlist() {
  if (!currentUserId.value || !expo.value) {
    alertStore.warn('请先登录')
    router.push('/')
    return
  }
  const ok = await presence.setWishlist(currentUserId.value, expo.value.id)
  if (!ok && presence.error.value) {
    alertStore.warn(presence.error.value)
  }
}

function openOnsiteSheet() {
  if (!expo.value) return
  // 默认选中开始日期
  selectedDate.value = expo.value.start_at.slice(0, 10)
  selectedTimeSlot.value = 'all_day'
  showOnsiteSheet.value = true
}

async function confirmOnsite() {
  if (!currentUserId.value || !expo.value) return
  const ok = await presence.setOnsite(
    currentUserId.value,
    expo.value.id,
    selectedDate.value,
    selectedTimeSlot.value
  )
  if (ok) {
    showOnsiteSheet.value = false
  } else if (presence.error.value) {
    alertStore.warn(presence.error.value)
  }
}

async function handleCancel() {
  if (!currentUserId.value || !expo.value) return
  const ok = await presence.cancel(currentUserId.value, expo.value.id)
  if (!ok && presence.error.value) {
    alertStore.warn(presence.error.value)
  }
}

function formatDate(iso: string) {
  return iso.slice(0, 10)
}

onMounted(() => {
  loadCurrentUser()
  loadExpo()
})
</script>

<template>
  <div class="expo-detail">
    <div v-if="!expo" class="loading">加载中...</div>

    <template v-else>
      <!-- 顶部返回 -->
      <div class="header">
        <button class="back-btn" @click="router.back()">←</button>
        <h1 class="title">{{ expo.title }}</h1>
      </div>

      <!-- 漫展信息 -->
      <div class="expo-card">
        <div class="expo-cover" :style="{ backgroundImage: `url(${expo.cover_url})` }" />
        <div class="expo-info">
          <div class="expo-date"> {{ formatDate(expo.start_at) }} ~ {{ formatDate(expo.end_at) }}</div>
          <div class="expo-tags">
            <span v-for="t in expo.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <p class="expo-desc">{{ expo.description }}</p>
        </div>
      </div>

      <!-- 状态显示 -->
      <div class="status-card">
        <div v-if="myPresence?.status === 'wishlist'" class="status wishlist">
          <span>已加入想去</span>
        </div>
        <div v-else-if="myPresence?.status === 'onsite'" class="status onsite">
          <span>
            在场确认：{{ myPresence.visit_date }}
            {{ myPresence.time_slot ? TIME_SLOT_LABEL[myPresence.time_slot] : '' }}
          </span>
        </div>
        <div v-else class="status none">
          <span>还没表达意向</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-bar">
        <button
          v-if="!myPresence || myPresence.status === 'cancelled'"
          class="btn-primary"
          :disabled="!canWishlist"
          @click="handleWishlist"
        >
          {{ canWishlist ? `想去（${myWishlistCount}/${WISHLIST_LIMIT}）` : '已达想去上限' }}
        </button>

        <button
          v-if="!myPresence || myPresence.status === 'cancelled'"
          class="btn-secondary"
          @click="openOnsiteSheet"
        >
          在场确认
        </button>

        <button
          v-if="myPresence && (myPresence.status === 'wishlist' || myPresence.status === 'onsite')"
          class="btn-cancel"
          @click="handleCancel"
        >
          取消
        </button>
      </div>

      <!-- 提示 -->
      <div class="hint">
        <!-- v0.10 修复（2026-10-03）：删除虚假承诺
             原文案「在场确认后，同窗会会优先匹配同时段在场的人（最高 50 分）」
             实测：sceneScoreV3 虽已实现（同场同时段 30 分），但其入口 searchRadarV3
             全项目无任何调用者 → 功能从未接上线，且分值是 30 不是 50。
             待同窗会重构接入漫展绑定后，再恢复真实文案。 -->
        <p>想去最多 {{ WISHLIST_LIMIT }} 个，按漫展/谷店/桌游/剧本杀/商场跨类型分配</p>
      </div>
    </template>

    <!-- 在场确认弹窗 -->
    <div v-if="showOnsiteSheet" class="sheet-overlay" @click.self="showOnsiteSheet = false">
      <div class="sheet">
        <div class="sheet-header">
          <h3>在场确认 - {{ expo?.title }}</h3>
          <button class="close-btn" @click="showOnsiteSheet = false">×</button>
        </div>

        <div class="sheet-body">
          <div class="field-label">哪一天在场？</div>
          <div class="date-options">
            <label
              v-for="opt in onsiteDateOptions"
              :key="opt.value"
              class="date-option"
              :class="{ active: selectedDate === opt.value }"
            >
              <input
                type="radio"
                :value="opt.value"
                v-model="selectedDate"
                style="display:none"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>

          <div class="field-label">时段？</div>
          <div class="time-slot-options">
            <label
              v-for="(label, value) in TIME_SLOT_LABEL"
              :key="value"
              class="time-option"
              :class="{ active: selectedTimeSlot === value }"
            >
              <input
                type="radio"
                :value="value"
                v-model="selectedTimeSlot"
                style="display:none"
              />
              <span>{{ label }}</span>
            </label>
          </div>
        </div>

        <div class="sheet-footer">
          <button class="btn-secondary" @click="showOnsiteSheet = false">取消</button>
          <button class="btn-primary" @click="confirmOnsite">确认在场</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.expo-detail {
  min-height: 100vh;
  background: #f7f7f7;
  padding: 16px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999;
}

.header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: white;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  margin-right: 12px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.expo-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.expo-cover {
  width: 100%;
  height: 180px;
  background-size: cover;
  background-position: center;
  background-color: #e0e0e0;
}

.expo-info {
  padding: 16px;
}

.expo-date {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.expo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.tag {
  background: #f0f0f0;
  color: #555;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.expo-desc {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin: 0;
}

.status-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-icon {
  font-size: 18px;
}

.status.wishlist {
  color: #f59e0b;
}

.status.onsite {
  color: #10b981;
}

.status.none {
  color: #999;
}

.action-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.btn-primary, .btn-secondary, .btn-cancel {
  flex: 1;
  height: 44px;
  border-radius: 22px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.btn-primary {
  background: #000;
  color: white;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #000;
  border: 1px solid #000;
}

.btn-cancel {
  background: white;
  color: #ef4444;
  border: 1px solid #ef4444;
}

.hint {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 12px;
  color: #888;
  line-height: 1.6;
}

.hint p {
  margin: 4px 0;
}

/* 在场确认弹窗 */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.sheet {
  background: white;
  width: 100%;
  max-width: 500px;
  border-radius: 16px 16px 0 0;
  padding: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.sheet-header h3 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

.field-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin: 12px 0 8px;
}

.date-options, .time-slot-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.date-option, .time-option {
  background: #f5f5f5;
  border: 1px solid transparent;
  padding: 8px 16px;
  border-radius: 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.date-option.active, .time-option.active {
  background: #000;
  color: white;
  border-color: #000;
}

.sheet-footer {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
</style>