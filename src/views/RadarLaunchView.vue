<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { RADAR_TIME_OPTIONS, type RadarTimeWindow } from '../lib/mockData'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { hashRoomPassword, isValidRoomPassword } from '../lib/roomPassword'

const router = useRouter()
const route = useRoute()
const store = useKizunaStore()

const timeWindow = ref<RadarTimeWindow>(900)
const intentWant = ref<string>('')
const intentProvide = ref<string>('')

// 线上/线下切换
const isOnline = ref<boolean>(false)
const location = ref<string>('')

const password = ref<string>('')
const usePassword = ref<boolean>(false)

const submitting = ref(false)
const error = ref<string>('')

// 定位中状态
const locating = ref(false)

// v0.10（2026-10-03）：线下确认漫展（选填）
const expoId = ref<string>('')

/** 可确认的漫展（进行中 + 即将开始） */
const selectableExpos = computed(() =>
  store.expos
    .filter(e => e.status === 'ongoing' || e.status === 'upcoming')
    .slice()
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
)

onMounted(() => {
  if (!store.currentUser) {
    // v0.10 修复（2026-10-03）：/radar 路由不存在 → 白屏；落首页
    router.replace('/home')
    return
  }
  // v0.10.4 修复（2026-10-05）：读取配对开房带入的意图（PairView.openRoomWith 传的 query），
  // 避免用户配对成功后开房还要重打一遍。此前 PairView 传了 query 但这里从未读取。
  const qw = route.query.intentWant
  const qp = route.query.intentProvide
  if (typeof qw === 'string' && qw) intentWant.value = qw
  if (typeof qp === 'string' && qp) intentProvide.value = qp
  // 拉取漫展列表供「线下确认漫展（选填）」使用（失败静默降级，不阻塞发起）
  store.fetchExpos().catch(() => {})
})

function expoDateRange(s: string, e: string): string {
  const f = (x: string) => {
    const d = new Date(x)
    return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}.${d.getDate()}`
  }
  return `${f(s)} - ${f(e)}`
}

function toggleExpo(id: string) {
  expoId.value = expoId.value === id ? '' : id
}

function parseTags(s: string): string[] {
  return s.split(/[,，、\n]/)
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map(t => t.slice(0, 20))
}

// 一键定位当前位置
async function getCurrentLocation() {
  locating.value = true
  error.value = ''
  try {
    // 尝试 Capacitor Geolocation（运行时动态检测，避免 build 时解析）
    const capModule = (window as any).Capacitor?.Plugins?.Geolocation
    if (capModule && capModule.getCurrentPosition) {
      const pos = await capModule.getCurrentPosition({ enableHighAccuracy: true })
      location.value = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
      locating.value = false
      return
    }
    // 降级：浏览器 Geolocation API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          location.value = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          locating.value = false
        },
        (err) => {
          error.value = '定位失败：' + err.message
          locating.value = false
        }
      )
    } else {
      error.value = '当前设备不支持定位'
      locating.value = false
    }
  } catch (e: any) {
    error.value = '定位失败：' + (e?.message || String(e))
    locating.value = false
  }
}

async function submit() {
  if (!store.currentUser) return

  // 线下必须填地址
  if (!isOnline.value && !location.value.trim()) {
    error.value = '请填写线下地点'
    return
  }

  if (!RADAR_TIME_OPTIONS.some(o => o.value === timeWindow.value)) {
    error.value = '请选择有效的时间'
    return
  }

  if (usePassword.value) {
    const pw = password.value.trim()
    if (!isValidRoomPassword(pw)) {
      error.value = '密码需为 4-6 位数字'
      return
    }
    password.value = pw
  }

  submitting.value = true
  error.value = ''

  try {
    const now = Date.now()
    const expiresAt = new Date(now + timeWindow.value * 1000).toISOString()

    // 线上地点显示为「线上」
    const finalLocation = isOnline.value ? '线上' : location.value.trim()

    const room = {
      id: crypto.randomUUID(),
      initiator_id: store.currentUser.id,
      time_window: timeWindow.value,
      intent_want: parseTags(intentWant.value),
      intent_provide: parseTags(intentProvide.value),
      location: finalLocation,
      has_password: usePassword.value,
      // v0.10（2026-10-03）：密码存 SHA-256 哈希，不再明文落库
      password: usePassword.value ? await hashRoomPassword(password.value) : null,
      // v0.10（2026-10-03）：线下确认的漫展（选填，未选为 null）
      expo_id: expoId.value || null,
      status: 'active' as const,
      created_at: new Date(now).toISOString(),
      expires_at: expiresAt,
      closed_at: null,
    }

    let supabaseOk = false
    if (isSupabaseConfigured()) {
      let { error: err } = await supabase.from('radar_rooms').insert(room)

      // v0.10：若 expo_id 列尚未创建（迁移未执行），降级为不绑漫展重试。
      // 否则整个 insert 会失败，房间只能存本地，用户看到假的「网络保存失败」。
      // PostgREST 未找到列时返回 PGRST204；PGRST23502 兼容 NOT NULL 类错误。
      const missingExpoColumn =
        !!err && (err.code === 'PGRST204' || err.message?.includes('expo_id'))
      if (missingExpoColumn) {
        console.warn('[RadarLaunch] expo_id 列不存在（迁移未执行），降级重试:', err?.message)
        const { expo_id: _omit, ...roomWithoutExpo } = room
        const retry = await supabase.from('radar_rooms').insert(roomWithoutExpo)
        err = retry.error
        // 本地房间也去掉 expo_id，保持与远程一致
        ;(room as any).expo_id = null
      }

      if (err) {
        console.warn('Supabase insert failed, fallback to local:', err.message)
        error.value = '网络保存失败，已临时保存在本地'
      } else {
        supabaseOk = true
      }
    }

    store.addRadarRoom(room)
    router.push(`/radar/room/${room.id}`)
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="launch-page">
    <header class="launch-header">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="launch-title">发起同窗会</h1>
    </header>

    <main class="launch-main">
      <!-- 时间 -->
      <section class="launch-section">
        <label class="section-label">时间</label>
        <div class="time-options">
          <button
            v-for="opt in RADAR_TIME_OPTIONS"
            :key="opt.value"
            @click="timeWindow = opt.value"
            class="time-chip"
            :class="{ 'time-chip-active': timeWindow === opt.value }"
          >
            {{ opt.label }}
          </button>
        </div>
      </section>

      <!-- 希望和提供 -->
      <section class="launch-section">
        <label class="section-label">希望和提供</label>
        <div class="intent-pair">
          <div class="intent-col">
            <span class="intent-sub-label">我希望</span>
            <textarea
              v-model="intentWant"
              class="intent-textarea"
              placeholder="想认识的人 / 想一起做的事"
              rows="3"
            />
          </div>
          <div class="intent-col">
            <span class="intent-sub-label">我能提供</span>
            <textarea
              v-model="intentProvide"
              class="intent-textarea"
              placeholder="我能提供的帮助 / 资源"
              rows="3"
            />
          </div>
        </div>
        <p class="hint"></p>
      </section>

      <!-- 线上/线下切换 -->
      <section class="launch-section">
        <label class="section-label">形式</label>
        <div class="mode-toggle">
          <button
            @click="isOnline = false"
            class="mode-btn"
            :class="{ 'mode-btn-active': !isOnline }"
          >
            线下
          </button>
          <button
            @click="isOnline = true"
            class="mode-btn"
            :class="{ 'mode-btn-active': isOnline }"
          >
            线上
          </button>
        </div>

        <!-- 线下：地址输入 + 定位按钮 -->
        <div v-if="!isOnline" class="location-wrapper">
          <div class="location-row">
            <input
              v-model="location"
              type="text"
              class="location-input"
              placeholder="输入线下地点"
            />
            <button
              @click="getCurrentLocation"
              :disabled="locating"
              class="locate-btn"
              title="定位当前位置"
            >
              {{ locating ? '定位中…' : '定位' }}
            </button>
          </div>
        </div>

        <!-- v0.10（2026-10-03）：线下可确认漫展（选填）
             确认后与同漫展同时段在场的人匹配更高分（最高 +30） -->
        <div v-if="!isOnline && selectableExpos.length > 0" class="expo-wrapper">
          <div class="expo-label">
            确认漫展<span class="expo-optional">（选填）</span>
          </div>
          <div class="expo-chips">
            <button
              v-for="ex in selectableExpos"
              :key="ex.id"
              class="expo-chip"
              :class="{ 'expo-chip-active': expoId === ex.id }"
              @click="toggleExpo(ex.id)"
            >
              <span class="expo-chip-title">{{ ex.title }}</span>
              <span class="expo-chip-date">{{ expoDateRange(ex.start_at, ex.end_at) }}</span>
            </button>
          </div>
          <p class="expo-hint">确认后，和同样在场的人匹配更高分</p>
        </div>

        <!-- 线上：不显示地址输入框 -->
        <div v-else class="online-hint">
          <p>线上同窗会，通过聊天交流</p>
        </div>
      </section>

      <!-- 密码 -->
      <section class="launch-section">
        <label class="section-label password-row">
          <input v-model="usePassword" type="checkbox" class="pw-checkbox" />
          <span>设置房间密码</span>
        </label>
        <input
          v-if="usePassword"
          v-model="password"
          type="text"
          class="password-input"
          placeholder="4-6 位数字密码"
          maxlength="6"
        />
      </section>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <button @click="submit" :disabled="submitting" class="submit-btn">
        {{ submitting ? '发起中...' : '发起' }}
      </button>
    </main>
  </div>
</template>

<style scoped>
.launch-page {
  min-height: 100vh;
  background: #f5f1e8;
  padding: 20px 20px calc(80px + env(safe-area-inset-bottom));
}
.launch-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.back-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #2b2a26;
  cursor: pointer;
  padding: 0;
}
.launch-title {
  font-size: 22px;
  font-weight: 700;
  color: #2b2a26;
  margin: 0;
}
.launch-main {
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.launch-section {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #f0ede5;
}
.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 12px;
  display: block;
}
.password-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
}
.pw-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}
.time-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.time-chip {
  padding: 8px 16px;
  border: 1px solid #e8e6e1;
  background: #fafaf8;
  border-radius: 20px;
  font-size: 13px;
  color: #5c5953;
  cursor: pointer;
  transition: all 0.18s ease;
}
.time-chip-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}
.intent-pair {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.intent-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.intent-sub-label {
  font-size: 12px;
  color: #8c8780;
}
.intent-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}
.intent-textarea:focus {
  outline: none;
  border-color: #2b2a26;
  background: #ffffff;
}
.hint {
  font-size: 11px;
  color: #a8a39a;
  margin: 8px 0 0;
}

/* 线上/线下切换 */
.mode-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.mode-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid #e8e6e1;
  background: #fafaf8;
  border-radius: 10px;
  font-size: 14px;
  color: #5c5953;
  cursor: pointer;
  transition: all 0.18s ease;
}
.mode-btn-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

/* 线下地址输入 */
.location-wrapper {
  margin-top: 8px;
}
.location-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.location-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 14px;
  box-sizing: border-box;
}
.location-input:focus {
  outline: none;
  border-color: #2b2a26;
  background: #ffffff;
}
.locate-btn {
  padding: 10px 14px;
  background: #2b2a26;
  color: #fff5dc;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
}
.locate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* v0.10（2026-10-03）：线下漫展确认 */
.expo-wrapper {
  margin-top: 12px;
  padding: 12px;
  background: #fafaf8;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
}
.expo-label {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 8px;
}
.expo-optional {
  color: #9c9891;
}
.expo-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.expo-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}
.expo-chip-active {
  background: #2b2a26;
  border-color: #2b2a26;
}
.expo-chip-title {
  font-size: 13px;
  color: #2b2a26;
}
.expo-chip-active .expo-chip-title {
  color: #fff5dc;
}
.expo-chip-date {
  font-size: 11px;
  color: #9c9891;
}
.expo-chip-active .expo-chip-date {
  color: #d8d3c6;
}
.expo-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #9c9891;
}

/* 线上提示 */
.online-hint {
  text-align: center;
  padding: 16px;
  background: #fafaf8;
  border-radius: 10px;
  color: #5c5953;
  font-size: 14px;
}
.online-hint p {
  margin: 0;
}

.password-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 14px;
  box-sizing: border-box;
}
.password-input:focus {
  outline: none;
  border-color: #2b2a26;
  background: #ffffff;
}
.error-msg {
  color: #c44545;
  font-size: 13px;
  text-align: center;
}
.submit-btn {
  width: 100%;
  padding: 14px;
  background: #2b2a26;
  color: #fff5dc;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}
.submit-btn:hover:not(:disabled) {
  background: #1a1a1a;
}
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
