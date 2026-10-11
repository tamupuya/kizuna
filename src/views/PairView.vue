<script setup lang="ts">
/**
 * PairView.vue — 双人配对（同窗会 v0.10，2026-10-03）
 *
 * 三段式：推窗 → 配对（看卡片，接受/跳过）→ 开房
 *
 * 设计要点（用户拍板，详见 src/lib/pairing.ts 顶部注释）：
 *   - 配对 ≠ 对话：「配对并不是对话，而是一些基本信息的交换」
 *   - 被跳过方无感：跳过不写任何记录，只写本地 skipSet
 *   - 配对成功不排他：可以同时认识几个人（这才是漫展扩列）
 *   - 产物当场有效，过期即散（方案 A）：不留「尸体列表」
 *   - 池子规模可见（只给总数，不给是谁）：把「黑等」变成「可行动的等」
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { useVenuePresence } from '../lib/venue'
import type { VenuePresence } from '../lib/venue'
import {
  usePairing,
  pickBestMatch,
  countOpenSignals,
  selfTestPairing,
  isMutual,
  type PairSignal,
  type PairDecision,
  type PairCandidate,
} from '../lib/pairing'
import { RADAR_TIME_OPTIONS } from '../lib/mockData'
import { isSupabaseConfigured } from '../lib/supabase'

const router = useRouter()
const store = useKizunaStore()
const pairing = usePairing()
const venuePresence = useVenuePresence()

type Stage = 'idle' | 'waiting' | 'reviewing' | 'waitingMutual' | 'matched'
const stage = ref<Stage>('idle')

// ---- 推窗表单 ----
const intentWant = ref('')
const intentProvide = ref('')
const timeWindow = ref(900)
const expoId = ref('')
const formError = ref('')

// ---- 信号池 ----
const mySignal = ref<PairSignal | null>(null)
const allSignals = ref<PairSignal[]>([])
const candidate = ref<PairCandidate | null>(null)
const poolSize = ref(0)
const loading = ref(false)
const offlineWarn = ref(false)
/**
 * 本地模式（Supabase 未配置 / 迁移未执行）
 *
 * ⚠️ 本地模式下【双向确认在物理上不可能成立】：
 * 双方要互相确认，必须有一个共同通道。没有通道就没有「对方」。
 * 所以此时绝不能把等待说成「在等对方回应」——那是编造一个不存在的对方。
 */
const localMode = computed(() => !isSupabaseConfigured())

// 本次同窗会内已接受的人（当场有效，过期即散 —— 不做长期列表）
const accepted = ref<string[]>([])
/** 我接受但对方尚未确认的人 */
const pendingWith = ref<string | null>(null)
/** 配对成立时的理由快照（candidate 已清空后仍要展示） */
const matchedReasons = ref<string[]>([])

/** 可确认的漫展（进行中 + 即将开始） */
const selectableExpos = computed(() =>
  store.expos
    .filter(e => e.status === 'ongoing' || e.status === 'upcoming')
    .slice()
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
)

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

function parseTags(input: string): string[] {
  return input
    .split(/[,，、\n]/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map(x => x.slice(0, 20))
}

// ---- 生命周期 ----

let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (!store.currentUser) {
    router.replace('/home')
    return
  }
  store.init()

  // 开发期自检：验证配对核心逻辑（无网络也能跑）
  const t = selfTestPairing()
  if (!t.pass) console.warn('[pair] 自检未通过:', t.cases)

  // 恢复现场：若已有未过期信号，直接进入等待
  const local = pairing.getLocalSignal()
  if (local && local.status === 'open' && local.expires_at > new Date().toISOString()) {
    mySignal.value = local
    intentWant.value = local.intent_want.join('、')
    intentProvide.value = local.intent_provide.join('、')
    timeWindow.value = local.time_window
    expoId.value = local.expo_id || ''
    stage.value = 'waiting'
    await refreshPool()
    startPolling()
  }

  accepted.value = pairing.getSeen()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

// ---- 推窗 ----

async function submitSignal() {
  formError.value = ''
  if (!store.currentUser) return

  const want = parseTags(intentWant.value)
  const provide = parseTags(intentProvide.value)
  if (want.length === 0 && provide.length === 0) {
    formError.value = '至少填一项：想认识什么，或能提供什么'
    return
  }

  loading.value = true
  try {
    mySignal.value = await pairing.openSignal({
      userId: store.currentUser.id,
      intentWant: want,
      intentProvide: provide,
      expoId: expoId.value || null,
      timeWindow: timeWindow.value,
    })
    stage.value = 'waiting'
    await refreshPool()
    startPolling()
  } catch (e: any) {
    formError.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

// ---- 等待 & 匹配 ----

function startPolling() {
  if (pollTimer) clearInterval(pollTimer)
  // 每 5 秒找一次（P0 无 Realtime 订阅 pair_signals，轮询足够）
  pollTimer = setInterval(() => {
    void tryMatch()
  }, 5000)
}

async function refreshPool() {
  const signals = await pairing.fetchOpenSignals()
  // 降级：Supabase 不可用时至少把自己的信号算进池子，避免显示 0 让人误以为「没人」
  const local = pairing.getLocalSignal()
  const list = signals.length > 0 ? signals : local ? [local] : []
  allSignals.value = list
  // 池子规模：排除自己（文案是「此刻也在这个场景里的人」，我不算「别人」）
  poolSize.value = countOpenSignals(list, store.currentUser?.id)
}

async function tryMatch() {
  if (!store.currentUser || !mySignal.value) return
  // 已接受但等对方确认时，也要继续轮询（看对方是否已同意）
  if (stage.value !== 'waiting' && stage.value !== 'waitingMutual') return

  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  offlineWarn.value = !online

  await refreshPool()

  // 拉取全体在场记录（best-effort：RLS 未开放时为空 → 自然降级不加同场分）
  let presences: VenuePresence[] = []
  try {
    presences = await venuePresence.fetchAllPresences()
  } catch {
    presences = []
  }

  const expoVenueMap: Record<string, string> = {}
  const expoTitleMap: Record<string, string> = {}
  for (const e of store.expos) {
    expoVenueMap[e.id] = e.venue_id
    expoTitleMap[e.id] = e.title
  }

  // 双向确认：若我已接受某人，先看对方是否也已接受
  if (stage.value === 'waitingMutual' && pendingWith.value) {
    const decisions: PairDecision[] = await pairing.fetchDecisions()
    if (isMutual(decisions, store.currentUser.id, pendingWith.value)) {
      pairing.markSeen(pendingWith.value)
      accepted.value = pairing.getSeen()
      matchedReasons.value = []   // 本地/无网时无法得知共同点，不编造
      stage.value = 'matched'
      return
    }
  }

  const pick = pickBestMatch({
    me: store.currentUser,
    mySignal: mySignal.value,
    signals: allSignals.value,
    users: store.users,
    skipSet: pairing.getSkipSet(),
    excludeUserIds: pairing.getDecidedIds(),
    allPresences: presences,
    expoVenueMap,
    expoTitleMap,
  })

  // 仅在「等待中」阶段推进到候选（已进入 reviewing 不被打断）
  if (pick && stage.value === 'waiting') {
    candidate.value = pick
    stage.value = 'reviewing'
  }
}

// ---- 接受 / 跳过 ----

function acceptCandidate() {
  if (!candidate.value || !store.currentUser) return
  // 双重确认的【第一方】：只记录「我愿意」
  // ⚠️ 不在此判定配对成立 —— 必须等对方也 accept
  matchedReasons.value = candidate.value.reasons
  pairing.acceptUser(candidate.value.user.id)
  void pairing.persistDecision(store.currentUser.id, candidate.value.user.id)
  pendingWith.value = candidate.value.user.id
  candidate.value = null
  stage.value = 'waitingMutual'
}

function skipCandidate() {
  if (!candidate.value) return
  // 规则②：跳过不写任何记录（落库即泄露），只写本地
  pairing.skipUser(candidate.value.user.id)
  candidate.value = null
  stage.value = 'waiting'
}

// ---- 开房（第二道门：关于「此刻」） ----

function openRoomWith() {
  if (!mySignal.value) return
  // 配对已成立；开房是【一件新事】，需要重新主动发起。
  // 房间的 intent 由本次配对信号带入，避免重复填写。
  router.push({
    path: '/radar/launch',
    query: {
      intentWant: mySignal.value.intent_want.join(','),
      intentProvide: mySignal.value.intent_provide.join(','),
    },
  })
}

/** 继续配对（不排他：配对成功不等于必须开房，还可以认识别人） */
async function continuePairing() {
  candidate.value = null
  pendingWith.value = null
  matchedReasons.value = []
  stage.value = 'waiting'
  await tryMatch()
}

/** 自「等待对方确认」状态撤回（对方尚未同意，我可以不等了） */
async function cancelPending() {
  pendingWith.value = null
  stage.value = 'waiting'
  await tryMatch()
}

// ---- 收窗 ----

async function closeSignalAndExit() {
  if (mySignal.value) await pairing.closeSignal(mySignal.value.id)
  if (pollTimer) clearInterval(pollTimer)
  // 落实「过期即散」：离开即清空本次会面痕迹
  pairing.clearSeen()
  mySignal.value = null
  stage.value = 'idle'
  accepted.value = []
  pendingWith.value = null
  router.push('/home#section-radar')
}

function goBack() {
  router.push('/home#section-radar')
}

/** 剩余时间文案 */
const remainingText = computed(() => {
  if (!mySignal.value) return ''
  const left = new Date(mySignal.value.expires_at).getTime() - Date.now()
  if (left <= 0) return '已到期'
  const min = Math.floor(left / 60000)
  if (min < 1) return `${Math.max(1, Math.floor(left / 1000))} 秒`
  if (min < 60) return `${min} 分钟`
  return `${Math.floor(min / 60)} 小时`
})
</script>

<template>
  <div class="pair-page">
    <header class="pair-header">
      <button @click="goBack" class="back-btn">←</button>
      <h1 class="pair-title">推窗</h1>
    </header>

    <main class="pair-main">
      <!-- ============ 阶段 1：推窗（我准备好了） ============ -->
      <section v-if="stage === 'idle'" class="pair-section">
        <p class="pair-lead">
          推开窗，看看此刻还有谁在这里。<br />
          不需要先想好说什么——先让彼此看见。
        </p>

        <label class="field-label">我想认识 / 想一起做</label>
        <textarea
          v-model="intentWant"
          class="field-input"
          rows="2"
          maxlength="120"
          placeholder="例如：逛展、拍照、拼团"
        />

        <label class="field-label">我能提供</label>
        <textarea
          v-model="intentProvide"
          class="field-input"
          rows="2"
          maxlength="120"
          placeholder="例如：后期、翻译、道具借用"
        />

        <label class="field-label">时间</label>
        <div class="chip-row">
          <button
            v-for="opt in RADAR_TIME_OPTIONS"
            :key="opt.value"
            class="chip"
            :class="{ 'chip-active': timeWindow === opt.value }"
            @click="timeWindow = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <template v-if="selectableExpos.length > 0">
          <label class="field-label">
            确认漫展<span class="field-optional">（选填）</span>
          </label>
          <div class="chip-row">
            <button
              v-for="ex in selectableExpos"
              :key="ex.id"
              class="chip chip-expo"
              :class="{ 'chip-active': expoId === ex.id }"
              @click="toggleExpo(ex.id)"
            >
              <span>{{ ex.title }}</span>
              <span class="chip-sub">{{ expoDateRange(ex.start_at, ex.end_at) }}</span>
            </button>
          </div>
          <p class="field-hint">确认后，和同样在场的人匹配更高分</p>
        </template>

        <p v-if="formError" class="pair-error">{{ formError }}</p>

        <button class="primary-btn" :disabled="loading" @click="submitSignal">
          {{ loading ? '推窗中…' : '推窗' }}
        </button>

        <p class="pair-note">
          配对只是交换基本信息，不是对话。双方都愿意，才开始聊。
        </p>
      </section>

      <!-- ============ 阶段 2：等待（池子规模可见） ============ -->
      <section v-else-if="stage === 'waiting'" class="pair-section">
        <div class="waiting-card">
          <div class="waiting-dot" />
          <p class="waiting-title">窗已经推开了</p>
          <p class="waiting-sub">
            剩下的 {{ remainingText }} 里，我会替你留意同样推开窗的人。
          </p>
        </div>

        <!-- 池子规模：只给总数，不给是谁 —— 把「黑等」变成「可行动的等」 -->
        <div class="pool-card">
          <div class="pool-num">{{ poolSize }}</div>
          <div class="pool-label">此刻也在这个场景里的人</div>
          <p v-if="poolSize <= 1" class="pool-hint">
            现在只有你。这不是你的问题——是此刻真的没人推开窗。
          </p>          <p v-else class="pool-hint">
            还在等双方都愿意的那一刻。若久等不到，可以放宽看看别处。
          </p>
        </div>

        <p v-if="offlineWarn" class="pair-error">网络异常，暂时看不到新的人</p>

        <button class="ghost-btn" @click="closeSignalAndExit">收窗</button>
      </section>

      <!-- ===== 阶段 3.5：我已愿意，等对方也愿意（双向确认不能替对方决定） ===== -->
      <section v-else-if="stage === 'waitingMutual'" class="pair-section">
        <div class="waiting-card">
          <div class="waiting-dot" />
          <p class="waiting-title">你愿意了</p>
          <p class="waiting-sub">
            已把你的意愿送出去。配对成立需要对方也愿意——<br />
            这件事不能替他决定。
          </p>
        </div>

        <p class="pair-note">
          <template v-if="localMode">
            未连接网络。现在推窗，只有你自己在这个池子里。
          </template>
          <template v-else>
            在对方回应之前，我们不会把你们说成「已经认识」。
          </template>
        </p>

        <button class="ghost-btn" @click="cancelPending">不等了，看别人</button>
        <button class="text-btn" @click="closeSignalAndExit">收窗离开</button>
      </section>

      <!-- ============ 阶段 3：配对（看到你是谁，接受/跳过） ============ -->
      <section v-else-if="stage === 'reviewing' && candidate" class="pair-section">
        <p class="pair-lead">有人也推开了窗。</p>

        <!-- 卡片摘要：只给兴趣/意图，无头像（符合 L0 默认，产品固定分层） -->
        <div class="candidate-card">
          <div class="candidate-head">
            <span class="candidate-score">{{ candidate.score }}</span>
            <span class="candidate-score-label">匹配度</span>
          </div>

          <div v-if="candidate.reasons.length" class="candidate-reasons">
            <span v-for="r in candidate.reasons" :key="r" class="reason-tag">{{ r }}</span>
          </div>

          <div v-if="candidate.user.identity_tags?.length" class="candidate-block">
            <div class="candidate-block-title">身份</div>
            <div class="tag-line">
              <span
                v-for="t in candidate.user.identity_tags.slice(0, 4)"
                :key="t"
                class="tag"
              >{{ t }}</span>
            </div>
          </div>

          <div v-if="candidate.user.intent_want?.length" class="candidate-block">
            <div class="candidate-block-title">想认识 / 想一起做</div>
            <div class="tag-line">
              <span v-for="t in candidate.user.intent_want.slice(0, 6)" :key="t" class="tag">{{ t }}</span>
            </div>
          </div>

          <div v-if="candidate.user.intent_provide?.length" class="candidate-block">
            <div class="candidate-block-title">能提供</div>
            <div class="tag-line">
              <span v-for="t in candidate.user.intent_provide.slice(0, 6)" :key="t" class="tag">{{ t }}</span>
            </div>
          </div>

          <p class="candidate-privacy">
            此刻只展示这些。真实昵称与头像，要双方都愿意之后才可见。
          </p>
        </div>

        <div class="action-row">
          <button class="ghost-btn flex-1" @click="skipCandidate">跳过</button>
          <button class="primary-btn flex-1" @click="acceptCandidate">愿意认识</button>
        </div>

        <p class="pair-note">跳过对方不会知道。护住自己的方式，不必留下痕迹。</p>
      </section>

      <!-- ============ 阶段 4：配对成功（已完成；开房是新事） ============ -->
      <section v-else-if="stage === 'matched'" class="pair-section">
        <div class="matched-card">
          <div class="matched-icon">窗</div>
          <p class="matched-title">你们看见了彼此</p>
          <p class="matched-sub">
            这一次交换完成了。想接着聊，才是下一件事。
          </p>
        </div>

        <div class="candidate-card compact">
          <div class="candidate-block">
            <div class="candidate-block-title">刚才的这一点</div>
            <div v-if="matchedReasons.length" class="tag-line">
              <span v-for="r in matchedReasons" :key="r" class="reason-tag">{{ r }}</span>
            </div>
            <p v-else class="candidate-privacy">此刻都在这里</p>
          </div>
        </div>

        <button class="primary-btn" @click="openRoomWith">现在开房聊</button>
        <button class="ghost-btn" @click="continuePairing">再看看别人</button>

        <p v-if="accepted.length > 0" class="pair-note">
          本次已认识 {{ accepted.length }} 人。这些不留存，离开即散。
        </p>

        <button class="text-btn" @click="closeSignalAndExit">收窗离开</button>
      </section>
    </main>

    <div class="safe-bottom" />
  </div>
</template>

<style scoped>
.pair-page {
  min-height: 100vh;
  background: #fafaf8;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  font-family: var(--kizuna-font-family);
}

.pair-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 8px;
}

.back-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e8e6e1;
  border-radius: 4px;
  background: #fff;
  color: #3c3c43;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.pair-title {
  font-size: 18px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0;
}

.pair-main {
  max-width: 480px;
  margin: 0 auto;
  padding: 8px 20px 0;
}

.pair-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pair-lead {
  font-size: 14px;
  line-height: 1.7;
  color: #5c5953;
  margin: 0 0 4px;
}

.field-label {
  font-size: 13px;
  color: #3c3c43;
  margin-top: 4px;
}

.field-optional {
  color: #9c9891;
}

.field-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  color: #3c3c43;
  box-sizing: border-box;
  resize: none;
  font-family: inherit;
}

.field-hint {
  font-size: 12px;
  color: #9c9891;
  margin: -4px 0 0;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e8e6e1;
  border-radius: 4px;
  color: #3c3c43;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

.chip-active {
  background: #2b2a26;
  border-color: #2b2a26;
  color: #fff5dc;
}

.chip-sub {
  font-size: 11px;
  color: #9c9891;
}

.chip-active .chip-sub {
  color: #d8d3c6;
}

.primary-btn {
  padding: 13px 20px;
  background: #2b2a26;
  color: #fff5dc;
  border: none;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-btn {
  padding: 13px 20px;
  background: #fff;
  color: #3c3c43;
  border: 1px solid #e8e6e1;
  border-radius: 4px;
  font-size: 15px;
  cursor: pointer;
  font-family: inherit;
}

.text-btn {
  padding: 8px;
  background: none;
  border: none;
  color: #9c9891;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

.pair-note {
  font-size: 12px;
  color: #9c9891;
  line-height: 1.7;
  text-align: center;
  margin: 4px 0 0;
}

.pair-error {
  font-size: 13px;
  color: #c44545;
  margin: 0;
}

/* 等待 */
.waiting-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.waiting-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2b2a26;
  margin-bottom: 6px;
  animation: pair-pulse 1.8s ease-in-out infinite;
}

@keyframes pair-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}

.waiting-title {
  font-size: 16px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0;
}

.waiting-sub {
  font-size: 13px;
  color: #9c9891;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

.pool-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px;
  background: #f4eede;
  border-radius: 4px;
}

.pool-num {
  font-size: 32px;
  font-weight: 700;
  color: #2b2a26;
  line-height: 1;
}

.pool-label {
  font-size: 13px;
  color: #5c5953;
}

.pool-hint {
  font-size: 12px;
  color: #8c8780;
  margin: 6px 0 0;
  text-align: center;
  line-height: 1.6;
}

/* 候选卡 */
.candidate-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.candidate-card.compact {
  gap: 8px;
  padding: 16px 20px;
}

.candidate-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0eee9;
}

.candidate-score {
  font-size: 28px;
  font-weight: 700;
  color: #2b2a26;
  line-height: 1;
}

.candidate-score-label {
  font-size: 12px;
  color: #9c9891;
}

.candidate-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reason-tag {
  font-size: 12px;
  padding: 3px 8px;
  background: #f4eede;
  border-radius: 4px;
  color: #5c5953;
}

.candidate-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.candidate-block-title {
  font-size: 12px;
  color: #9c9891;
}

.tag-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: 12px;
  padding: 3px 8px;
  background: #fafaf8;
  border: 1px solid #eee;
  border-radius: 4px;
  color: #3c3c43;
}

.candidate-privacy {
  font-size: 12px;
  color: #9c9891;
  line-height: 1.6;
  margin: 0;
}

.action-row {
  display: flex;
  gap: 10px;
}

.flex-1 {
  flex: 1;
}

/* 配对成功 */
.matched-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 20px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.matched-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
  background: #f4eede;
  border-radius: 4px;
  margin-bottom: 6px;
}

.matched-title {
  font-size: 17px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0;
}

.matched-sub {
  font-size: 13px;
  color: #9c9891;
  margin: 0;
  text-align: center;
  line-height: 1.6;
}

.safe-bottom {
  height: 24px;
}
</style>
