<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { findMatchesV2, recommendByScene } from '../lib/matching-v2'
import { searchRadarRooms, type RadarRoomCandidate } from '../lib/matching-v3'
import { useVenuePresence } from '../lib/venue'
import { maskName } from '../lib/nameMask'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const store = useKizunaStore()
const initialLoad = ref(true)

// v0.10（2026-10-03）：同窗会「同漫展 + 同时段」加分需要全体在场记录
// best-effort：RLS 未开放读时为空数组 → 自然降级，不阻断页面
const venuePresence = useVenuePresence()

// v0.9.23.4：断网重试
function retryFetch() {
  store.fetchExpos()
  store.fetchVenues()
  store.fetchRadarRooms()
}

onMounted(async () => {
  initialLoad.value = true
  try {
    await store.init()
    // best-effort：拉全体在场记录供同窗会匹配（失败静默降级）
    void venuePresence.fetchAllPresences()
  } catch (e) {
    console.error('[HomeView] init failed:', e)
  } finally {
    initialLoad.value = false
  }
})

// 漫展变更实时提示
const expoUpdateHint = ref('')
let hintTimer: any = null
function onExposChanged(e: any) {
  const ev = e.detail?.event
  const expo = e.detail?.expo
  const title = expo?.title || '漫展'
  if (ev === 'INSERT') expoUpdateHint.value = ` 新漫展：${title}`
  else if (ev === 'UPDATE') expoUpdateHint.value = ` 已更新：${title}`
  else if (ev === 'DELETE') expoUpdateHint.value = ` 已删除：${title}`
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { expoUpdateHint.value = '' }, 4000)
}
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('kizuna:expos-changed', onExposChanged)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('kizuna:expos-changed', onExposChanged)
  }
})

const profile = computed(() => store.currentUser as any)
const isFirstTime = computed(() => {
  if (!profile.value) return false
  return !profile.value.cn || profile.value.cn === '用户 1' || !profile.value.identity_tags?.length
})

const matches = computed(() => {
  if (!profile.value) return []
  return findMatchesV2(profile.value, store.users as any[], undefined, [], 3)
})

/** v2 分桶 - 用于 "今天同在" 和 "同城" 区 */
const buckets = computed(() => {
  if (!profile.value) return null
  return recommendByScene(profile.value, store.users as any[], undefined, { perBucket: 3 })
})

const todayDate = computed(() => {
  const d = new Date()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 · ${weekDays[d.getDay()]}`
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

// === p0 quickTab 重构 ===
// 不再 router.push，改为 v-show 控制 + scrollIntoView
const quickTabs = [
  { id: 'all',    label: '全部',   icon: '' },
  { id: 'expos',  label: '漫展',   icon: '' },
  { id: 'radar',  label: '同窗会', icon: '' },
]
const activeTab = ref<'all' | 'expos' | 'radar'>('all')

function onTabClick(t: any) {
  activeTab.value = t.id
  // 下一个 tick，等 v-show 完成 DOM 更新后再滚动
  nextTick(() => {
    const el = document.getElementById(`section-${t.id === 'all' ? 'match' : t.id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// === 漫展 section 逻辑（从 ExposView 移入）===
const expoFilter = ref<'all' | 'ongoing' | 'upcoming'>('all')
const filteredExpos = computed(() => {
  if (expoFilter.value === 'all') return store.expos
  return store.expos.filter(e => e.status === expoFilter.value)
})
const venueMap = computed(() => {
  const map: Record<string, any> = {}
  for (const v of store.venues) map[v.id] = v
  return map
})

// === 同窗会 section 逻辑（从 RadarRoomsView 移入）===
const radarRoomCandidates = computed<RadarRoomCandidate[]>(() => {
  if (!store.currentUser) return []

  // v0.10：expo_id → venue_id / 标题映射，供同漫展加分
  const expoVenueMap: Record<string, string> = {}
  const expoTitleMap: Record<string, string> = {}
  for (const e of store.expos) {
    expoVenueMap[e.id] = e.venue_id
    expoTitleMap[e.id] = e.title
  }

  return searchRadarRooms({
    currentUser: store.currentUser,
    allRooms: store.radarRooms,
    allUsers: store.users,
    allPresences: venuePresence.allPresences.value,
    expoVenueMap,
    expoTitleMap,
  })
})
const myJoinedRooms = computed<RadarRoomCandidate[]>(() => {
  if (!store.currentUser) return []
  const uid = store.currentUser.id
  return radarRoomCandidates.value.filter(c =>
    c.room.initiator_id === uid ||
    (c.room.participants && c.room.participants.includes(uid))
  )
})

function formatTimeLeft(expiresAt: string): string {
  const d = new Date(expiresAt)
  if (isNaN(d.getTime())) return '已到期'
  const ms = d.getTime() - Date.now()
  if (ms <= 0) return '已到期'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `剩 ${min} 分钟`
  const h = Math.floor(min / 60)
  return `剩 ${h} 小时`
}

function go(path: string) {
  router.push(path)
}

function formatDate(s: string) {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function dateRange(s: string, e: string) {
  return `${formatDate(s)} - ${formatDate(e)}`
}

function expoVenueName(id: string) {
  return venueMap.value[id]?.name || '未知场地'
}
</script>

<template>
  <transition name="kz-toast">
    <div v-if="expoUpdateHint" class="expo-update-toast">
      {{ expoUpdateHint }}
    </div>
  </transition>
  <div class="home-page">
    <div class="home-shell">
      <!-- v0.9.23：品牌头已删除（p0-1） -->

      <!-- quickTab：不跳页，v-show + scrollIntoView -->
      <nav class="quick-tabs kz-rise" style="animation-delay: 0.05s">
        <button
          v-for="t in quickTabs"
          :key="t.id"
          class="qt-pill"
          :class="{ 'qt-pill-active': activeTab === t.id }"
          @click="onTabClick(t)"
        >
          <span class="qt-icon">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
        </button>
      </nav>

      <!-- v0.9.23.4：断网提示 banner -->
      <div v-if="!store.expoOnline" class="offline-banner">
        <span class="offline-icon">⚠</span>
        <span class="offline-text">网络异常，显示的是缓存数据</span>
        <button class="offline-retry" @click="retryFetch">重试</button>
      </div>

      <!-- 首屏骨架 -->
      <div v-if="initialLoad" class="kz-skeleton">
        <div class="kz-skel-bar kz-skel-bar-lg"></div>
        <div class="kz-skel-grid">
          <div class="kz-skel-stat" v-for="i in 4" :key="i"></div>
        </div>
        <div class="kz-skel-bar"></div>
        <div class="kz-skel-tile"></div>
      </div>

      <!-- 没有用户 -->
      <div v-else-if="!profile" class="create-cta kz-rise" @click="go('/editor')">
        <div class="cta-greeting">
          <div class="cta-eyebrow">起步</div>
          <h1 class="cta-title">先创建一张卡片吧</h1>
          <p class="cta-desc"></p>
        </div>
        <div class="cta-action">
          <span class="cta-btn">创建人设卡</span>
          <span class="cta-arrow">→</span>
        </div>
      </div>

      <!-- 有用户但首次 -->
      <div v-else-if="isFirstTime" class="create-cta kz-rise" @click="go('/editor')">
        <div class="cta-greeting">
          <div class="cta-eyebrow">待完成</div>
          <h1 class="cta-title">完善人设卡</h1>
          <p class="cta-desc">继续完成ta</p>
        </div>
        <div class="cta-action">
          <span class="cta-btn">继续填写</span>
          <span class="cta-arrow">→</span>
        </div>
      </div>

      <template v-else>
        <!-- v0.9.23：4 宫格统计卡已删除（p0-1） -->

        <!-- Matches banner（始终显示）-->
        <section
          v-if="buckets && (buckets.onSite.length + buckets.upcoming.length + buckets.city.length > 0)"
          id="section-match"
          class="match-banner kz-rise"
          style="animation-delay: 0.2s"
          @click="go('/home/matches')"
        >
          <div class="mb-text">
            <div class="mb-title" v-if="buckets.onSite.length > 0">
              今天 {{ buckets.onSite.length }} 位同好与你同场
            </div>
            <div class="mb-title" v-else-if="buckets.upcoming.length > 0">
              {{ buckets.upcoming.length }} 位同好与你同想去看展
            </div>
            <div class="mb-title" v-else>
              {{ buckets.city.length }} 位同城同好
            </div>
            <div class="mb-sub">
              <template v-if="buckets.onSite.length > 0">同一场漫展，看现场能不能捉到 TA</template>
              <template v-else-if="buckets.upcoming.length > 0">看看 TA 为什么去，也为什么不去</template>
              <template v-else>同城同好，线下面基可能更方便</template>
            </div>
          </div>
          <div class="mb-arrow">→</div>
          <div class="mb-avatars">
            <img
              v-for="m in (buckets.onSite.length > 0 ? buckets.onSite : buckets.upcoming.length > 0 ? buckets.upcoming : buckets.city).slice(0, 3)"
              :key="m.user.id"
              :src="m.user.avatar_url"
              :alt="m.user.cn"
              class="mb-avatar"
            />
          </div>
        </section>

        <!-- 漫展 section：activeTab 为 'all' 或 'expos' 时显示 -->
        <section
          v-show="activeTab !== 'radar'"
          id="section-expos"
          class="section kz-rise"
          style="animation-delay: 0.3s"
        >
          <header class="section-header">
            <h2 class="section-title">漫展</h2>
          </header>

          <!-- 筛选条 -->
          <div class="expo-filter">
            <button
              v-for="f in [{k: 'all', l: '全部'}, {k: 'ongoing', l: '进行中'}, {k: 'upcoming', l: '即将开始'}]"
              :key="f.k"
              class="ef-pill"
              :class="{ 'ef-pill-active': expoFilter === f.k }"
              @click="expoFilter = f.k as any"
            >{{ f.l }}</button>
          </div>

          <EmptyState
            v-if="filteredExpos.length === 0"
            emoji=""
            title="近期还没有漫展"
            desc="试试扩大范围"
            variant="compact"
          />

          <div v-else class="expo-stack">
            <div
              v-for="(expo, idx) in filteredExpos.slice(0, 8)"
              :key="expo.id"
              class="expo-tile kz-tap"
              :class="`expo-tile-${idx % 2}`"
              @click="go(`/expo/${expo.id}`)"
            >
              <div class="expo-img-wrap">
                <img :src="expo.cover_url" :alt="expo.title" />
                <span v-if="expo.status === 'ongoing'" class="expo-status">● 进行中</span>
                <span v-else-if="expo.status === 'upcoming'" class="expo-status expo-status-up">即将开始</span>
              </div>
              <div class="expo-body">
                <h3 class="expo-name">{{ expo.title }}</h3>
                <p class="expo-date">{{ dateRange(expo.start_at, expo.end_at) }}</p>
                <p class="expo-venue">{{ expoVenueName(expo.venue_id) }}</p>
                <div v-if="expo.tags?.length" class="expo-tags">
                  <span v-for="t in expo.tags.slice(0, 3)" :key="t" class="expo-tag">{{ t }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 同窗会 section：activeTab 为 'all' 或 'radar' 时显示 -->
        <section
          v-show="activeTab !== 'expos'"
          id="section-radar"
          class="section kz-rise"
          style="animation-delay: 0.4s"
        >
          <header class="section-header">
            <h2 class="section-title">同窗会</h2>
            <button class="section-edit" @click="go('/radar/launch')">+ 发起</button>
          </header>

          <!-- 我在的房间 -->
          <template v-if="myJoinedRooms.length > 0">
            <h3 class="sub-section-title">我在的房间 ({{ myJoinedRooms.length }})</h3>
            <div class="radar-stack">
              <div
                v-for="c in myJoinedRooms"
                :key="c.room.id"
                class="radar-card radar-card-my kz-tap"
                @click="go(`/radar/room/${c.room.id}`)"
              >
                <div class="rc-row">
                  <span class="rc-name">
                    {{ maskName(c.initiator.cn, c.initiator.gender, c.initiator.hide_name) }}
                    <span v-if="c.room.initiator_id === store.currentUserId" class="rc-badge rc-badge-host">房主</span>
                    <span v-else class="rc-badge rc-badge-joined">我在</span>
                  </span>
                  <span class="rc-score">{{ c.score }}%</span>
                </div>
                <div class="rc-meta">
                  <span>{{ formatTimeLeft(c.room.expires_at) }}</span>
                  <span v-if="c.room.has_password" class="rc-lock">密码</span>
                </div>
                <div v-if="c.room.intent_want.length" class="rc-line">
                  <span class="rc-tag rc-tag-want">希望</span>
                  <span class="rc-text">{{ c.room.intent_want.slice(0, 3).join('、') }}</span>
                </div>
                <div v-if="c.room.intent_provide.length" class="rc-line">
                  <span class="rc-tag rc-tag-provide">提供</span>
                  <span class="rc-text">{{ c.room.intent_provide.slice(0, 3).join('、') }}</span>
                </div>
                <div class="rc-line">
                  <span class="rc-tag rc-tag-loc">地点</span>
                  <span class="rc-text">{{ c.room.location }}</span>
                </div>
              </div>
            </div>
          </template>

          <h3 class="sub-section-title">正在进行的同窗会 ({{ radarRoomCandidates.length }})</h3>

          <EmptyState
            v-if="radarRoomCandidates.length === 0"
            emoji=""
            title="还没有同窗会"
            desc=""
            variant="compact"
          />

          <div v-else class="radar-stack">
            <div
              v-for="c in radarRoomCandidates"
              :key="c.room.id"
              class="radar-card kz-tap"
              @click="go(`/radar/room/${c.room.id}`)"
            >
              <div class="rc-row">
                <span class="rc-name">
                  {{ maskName(c.initiator.cn, c.initiator.gender, c.initiator.hide_name) }}
                  <span v-if="c.room.initiator_id === store.currentUserId" class="rc-badge rc-badge-host">房主</span>
                </span>
                <span class="rc-score">{{ c.score }}%</span>
              </div>
              <div class="rc-meta">
                <span>{{ formatTimeLeft(c.room.expires_at) }}</span>
                <span v-if="c.room.has_password" class="rc-lock">密码</span>
              </div>
              <div v-if="c.room.intent_want.length" class="rc-line">
                <span class="rc-tag rc-tag-want">希望</span>
                <span class="rc-text">{{ c.room.intent_want.slice(0, 3).join('、') }}</span>
              </div>
              <div v-if="c.room.intent_provide.length" class="rc-line">
                <span class="rc-tag rc-tag-provide">提供</span>
                <span class="rc-text">{{ c.room.intent_provide.slice(0, 3).join('、') }}</span>
              </div>
              <div class="rc-line">
                <span class="rc-tag rc-tag-loc">地点</span>
                <span class="rc-text">{{ c.room.location }}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="safe-bottom" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.expo-update-toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(43, 42, 38, 0.92);
  color: #fff5dc;
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  backdrop-filter: blur(8px);
  pointer-events: none;
  max-width: 90vw;
  text-align: center;
}
.kz-toast-enter-active,
.kz-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.kz-toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
.kz-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
.home-page {
  min-height: 100vh;
  background: var(--kizuna-grad-brand);
  padding: 16px 0 calc(80px + env(safe-area-inset-bottom));
  font-family: var(--kizuna-font-family);
}

.home-shell {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 二级 Tab */
.quick-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 16px;
  margin: 0 0 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.quick-tabs::-webkit-scrollbar { display: none; }

/* v0.9.23.4：断网 banner */
.offline-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 0 0 12px;
  background: #fdf0f0;
  border: 1px solid #f0c4c4;
  border-radius: 8px;
}
.offline-icon {
  font-size: 14px;
  color: #c44545;
}
.offline-text {
  flex: 1;
  font-size: 13px;
  color: #b0413e;
}
.offline-retry {
  padding: 4px 12px;
  background: #c44545;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.offline-retry:active {
  background: #a83535;
}

.qt-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--kizuna-bg-card);
  border: 1px solid var(--kizuna-border);
  border-radius: 999px;
  color: var(--kizuna-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s var(--kizuna-ease);
  white-space: nowrap;
}

.qt-pill:active {
  transform: scale(0.95);
}

.qt-pill-active {
  background: var(--kizuna-grad-cta);
  color: var(--kizuna-primary);
  border-color: transparent;
  box-shadow: var(--kizuna-shadow-sm);
}

.qt-icon {
  font-size: 14px;
  line-height: 1;
}

/* 品牌头 */
.home-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0 24px;
}

.home-brand-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.home-logo-mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--kizuna-grad-cta);
  color: var(--kizuna-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  box-shadow: var(--kizuna-shadow-sm);
  flex-shrink: 0;
}

.home-logo-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: 0.15em;
  line-height: 1;
}

.home-logo-date {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  letter-spacing: 0.05em;
  margin-top: 3px;
}

.home-greeting {
  flex: 1;
  text-align: right;
}

.home-greeting-text {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  letter-spacing: 0.05em;
}

.home-greeting-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--kizuna-text);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.home-brand-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
  border: 1.5px solid var(--kizuna-bg-elevated);
  flex-shrink: 0;
  transition: transform 0.2s var(--kizuna-ease);
}

.home-brand-avatar:hover {
  transform: scale(1.05);
}

/* First time CTA */
.create-cta {
  background: var(--kizuna-grad-cta);
  border-radius: var(--kizuna-radius-xl);
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid var(--kizuna-border);
  cursor: pointer;
  transition: all 0.2s var(--kizuna-ease);
  box-shadow: var(--kizuna-shadow-sm);
}

.create-cta:hover {
  transform: translateY(-2px);
  box-shadow: var(--kizuna-shadow-md);
}

.cta-eyebrow {
  font-size: 10px;
  color: var(--kizuna-primary);
  letter-spacing: 0.2em;
  font-weight: 600;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.cta-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: -0.02em;
  margin: 0 0 4px;
}

.cta-desc {
  font-size: 13px;
  color: var(--kizuna-text-soft);
  margin: 0;
  line-height: 1.5;
}

.cta-action {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cta-btn {
  font-size: 14px;
  font-weight: 600;
  color: var(--kizuna-primary);
}

.cta-arrow {
  font-size: 22px;
  color: var(--kizuna-primary);
  transition: transform 0.2s var(--kizuna-ease);
}

.create-cta:hover .cta-arrow {
  transform: translateX(4px);
}

/* Stats grid */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  background: var(--kizuna-bg-elevated);
  border-radius: var(--kizuna-radius-lg);
  margin-bottom: 18px;
  border: 1px solid var(--kizuna-border);
  overflow: hidden;
  box-shadow: var(--kizuna-shadow-sm);
}

.stat {
  padding: 14px 4px;
  text-align: center;
  cursor: pointer;
  transition: background 0.18s ease;
  border-right: 1px solid var(--kizuna-border);
  position: relative;
}

.stat:last-child {
  border-right: none;
}

.stat:hover {
  background: var(--kizuna-bg);
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  margin-top: 2px;
}

/* Matches banner */
.match-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--kizuna-grad-cta);
  border-radius: var(--kizuna-radius-lg);
  margin-bottom: 18px;
  border: 1px solid var(--kizuna-border-strong);
  cursor: pointer;
  transition: all 0.18s var(--kizuna-ease);
}

.match-banner:hover {
  transform: translateY(-1px);
  box-shadow: var(--kizuna-shadow-md);
}

.mb-text {
  flex: 1;
  min-width: 0;
}

.mb-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--kizuna-text);
  margin-bottom: 2px;
}

.mb-sub {
  font-size: 11px;
  color: var(--kizuna-text-soft);
}

.mb-arrow {
  font-size: 20px;
  color: var(--kizuna-primary);
  flex-shrink: 0;
}

.mb-avatars {
  display: flex;
  flex-shrink: 0;
}

.mb-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid var(--kizuna-bg-elevated);
  object-fit: cover;
  margin-left: -8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mb-avatar:first-child {
  margin-left: 0;
}

/* Section */
.section {
  margin-bottom: 18px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 4px 12px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: -0.01em;
  margin: 0;
}

.section-edit {
  background: none;
  border: none;
  font-size: 13px;
  color: var(--kizuna-primary);
  cursor: pointer;
  font-weight: 500;
}

.sub-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--kizuna-text-soft);
  margin: 12px 4px 10px;
  letter-spacing: 0.02em;
}

/* 漫展筛选条 */
.expo-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.ef-pill {
  flex: 0 0 auto;
  padding: 5px 12px;
  background: transparent;
  border: 1px solid var(--kizuna-border);
  border-radius: 999px;
  color: var(--kizuna-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s var(--kizuna-ease);
}

.ef-pill-active {
  background: var(--kizuna-primary);
  color: var(--kizuna-primary-soft);
  border-color: var(--kizuna-primary);
}

/* Expo stack */
.expo-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.expo-tile {
  display: flex;
  gap: 12px;
  background: var(--kizuna-bg-elevated);
  border-radius: var(--kizuna-radius-lg);
  overflow: hidden;
  border: 1px solid var(--kizuna-border);
  cursor: pointer;
  transition: all 0.18s var(--kizuna-ease);
  box-shadow: var(--kizuna-shadow-sm);
}

.expo-tile:hover {
  transform: translateY(-1px);
  box-shadow: var(--kizuna-shadow-md);
  border-color: var(--kizuna-border-strong);
}

.expo-tile-1 {
  flex-direction: row-reverse;
}

.expo-img-wrap {
  position: relative;
  width: 110px;
  height: 90px;
  flex-shrink: 0;
}

.expo-img-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.expo-status {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 10px;
  padding: 2px 7px;
  background: rgba(43, 42, 38, 0.85);
  color: var(--kizuna-primary-soft);
  border-radius: 8px;
  backdrop-filter: blur(6px);
  font-weight: 600;
}

.expo-status-up {
  background: rgba(255, 245, 220, 0.95);
  color: var(--kizuna-primary);
  border: 1px solid var(--kizuna-border-strong);
}

.expo-body {
  flex: 1;
  padding: 10px 14px 10px 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.expo-tile-1 .expo-body {
  padding: 10px 0 10px 14px;
}

.expo-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--kizuna-text);
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expo-date {
  font-size: 11px;
  color: var(--kizuna-text-soft);
  margin: 0 0 2px;
}

.expo-venue {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  margin: 0 0 6px;
}

.expo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.expo-tag {
  font-size: 10px;
  padding: 1px 7px;
  background: var(--kizuna-bg);
  border: 1px solid var(--kizuna-border);
  border-radius: 8px;
  color: var(--kizuna-text-soft);
}

/* 同窗会 stack */
.radar-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-card {
  background: var(--kizuna-bg-elevated);
  border-radius: var(--kizuna-radius-lg);
  padding: 12px 14px;
  border: 1px solid var(--kizuna-border);
  cursor: pointer;
  transition: all 0.18s var(--kizuna-ease);
  box-shadow: var(--kizuna-shadow-sm);
}

.radar-card:hover {
  transform: translateY(-1px);
  border-color: var(--kizuna-border-strong);
  box-shadow: var(--kizuna-shadow-md);
}

.radar-card-my {
  background: #fff5dc;
  border: 1px solid #e8d9b5;
  border-left: 4px solid #2b2a26;
}

.rc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.rc-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--kizuna-text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.rc-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 500;
}

.rc-badge-host {
  background: #2b2a26;
  color: #fff5dc;
}

.rc-badge-joined {
  background: rgba(43, 42, 38, 0.1);
  color: var(--kizuna-primary);
}

.rc-score {
  font-size: 13px;
  font-weight: 700;
  color: var(--kizuna-primary);
}

.rc-meta {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  margin-bottom: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.rc-lock {
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(229, 57, 53, 0.1);
  color: #c62828;
  border-radius: 6px;
}

.rc-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  margin-top: 4px;
}

.rc-tag {
  flex: 0 0 auto;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 6px;
  font-weight: 500;
}

.rc-tag-want {
  background: rgba(21, 101, 192, 0.12);
  color: #1565c0;
}

.rc-tag-provide {
  background: rgba(46, 125, 50, 0.12);
  color: #2e7d32;
}

.rc-tag-loc {
  background: rgba(106, 27, 154, 0.12);
  color: #6a1b9a;
}

.rc-text {
  flex: 1;
  color: var(--kizuna-text-soft);
  line-height: 1.5;
  word-break: break-word;
}

.safe-bottom {
  height: 24px;
}
</style>