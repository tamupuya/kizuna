<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { maskName } from '../lib/nameMask'
import type { RadarRoomMessage } from '../lib/mockData'
import { supabase } from '../lib/supabase'
import { verifyRoomPassword } from '../lib/roomPassword'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useKizunaStore()

const roomId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})
const room = computed(() => store.radarRooms.find(r => r.id === roomId.value))
const initiator = computed(() => room.value ? store.users.find(u => u.id === room.value!.initiator_id) : null)
const isInitiator = computed(() => room.value && store.currentUser && room.value.initiator_id === store.currentUser.id)

// 参与人数：房主恒在场 + participants 中进入过的参与者
// v0.10 修复（2026-10-03）：原为 onlineCount = ref(1) 硬编码，从未更新
// → 导致 "N 人在线" 显示假数据，且解散确认弹窗永不触发（otherCount 恒为 0）
// 注：这是「进入过房间的人数」，不是实时在线数（P0 无 presence 订阅）
const participantCount = computed(() => {
  if (!room.value) return 0
  return 1 + (room.value.participants?.length || 0)
})

const needPassword = ref(false)
const passwordInput = ref('')
const passwordError = ref('')
const joined = ref(false)

const error = ref<string>('')
const messageText = ref('')
const messages = ref<RadarRoomMessage[]>([])
const messageListEl = ref<HTMLElement | null>(null)
// v0.9.18 p1：消息输入框 ref（发送后保持焦点）
const msgInputEl = ref<HTMLInputElement | null>(null)
// v0.9.23.4：断网提示
const offlineWarn = ref(false)

// v0.9.18 p1：点聊天区域空白处收起键盘（QQ/微信 风格）
function onMessagesAreaClick(e: MouseEvent) {
  // 只在点击非消息行时 blur（避免点消息也收起）
  const target = e.target as HTMLElement
  if (target.classList.contains('rr-messages') || target.classList.contains('msg-row')) {
    msgInputEl.value?.blur()
  }
}

// 解散弹窗
const showDissolveModal = ref(false)
const dissolveConfirmText = ref('')

// 退出弹窗（参与者）
const showLeaveModal = ref(false)

// 人设卡分享弹窗
const showCardShare = ref(false)

onMounted(async () => {
  if (store.users.length === 0) await store.fetchUsers()
  if (store.radarRooms.length === 0) await store.fetchRadarRooms()

  await nextTick()
  if (!room.value) return

  // 密码房间：未输入密码时拦截（房主跳过）
  if (room.value.has_password && !isInitiator.value && !joined.value) {
    needPassword.value = true
    return
  }
  joined.value = true
  await loadMessages()

  // v0.9.18：把当前用户加入 participants 列表（用于 RadarRoomsView "我在的房间" 区块）
  addSelfAsParticipant()

  // Realtime 监听
  store.subscribeRealtime()
})

// v0.9.18：返回键只 push 路由，不删数据（点"←"是返回，不是退出）
// v0.10 修复（2026-10-03）：/radar 路由不存在（返回白屏），同窗会 section 在首页
function goBack() {
  router.push('/home#section-radar')
}

// v0.9.18：进入房间时把当前用户加入 participants
function addSelfAsParticipant() {
  if (!room.value || !store.currentUser) return
  const uid = store.currentUser.id
  if (room.value.initiator_id === uid) return // 房主不需要
  const arr = room.value.participants || []
  if (arr.includes(uid)) return
  // 本地立即更新
  const idx = store.radarRooms.findIndex(r => r.id === room.value!.id)
  if (idx >= 0) {
    store.radarRooms[idx] = { ...store.radarRooms[idx], participants: [...arr, uid] }
  }
  // 远程同步（失败不阻塞）
  supabase.from('radar_rooms').update({ participants: [...arr, uid] }).eq('id', room.value.id)
    .then(({ error }) => { if (error) console.warn('addSelfAsParticipant sync failed:', error.message) })
}

// Realtime 新消息处理器
function handleNewRadarMessage(e: CustomEvent) {
  const m = e.detail as RadarRoomMessage
  if (!room.value) return
  if (m.room_id !== room.value.id) return
  if (messages.value.some(existing => existing.id === m.id)) return
  messages.value = [...messages.value, m]
  scrollToBottom()
}

onMounted(() => {
  window.addEventListener('kizuna:new-radar-message', handleNewRadarMessage as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('kizuna:new-radar-message', handleNewRadarMessage as EventListener)
})

async function loadMessages() {
  if (!room.value) return
  if (new Date(room.value.expires_at).getTime() <= Date.now()) {
    error.value = '房间已到期'
    return
  }
  // 优先从本地缓存读取
  const cached = store.getMessagesByRoom(room.value.id)
  if (cached.length > 0) {
    messages.value = cached
    await nextTick()
    scrollToBottom()
  }
  // 同时从远程拉取（增量更新）
  try {
    const { data } = await supabase
      .from('radar_room_messages')
      .select('*')
      .eq('room_id', room.value.id)
      .order('created_at', { ascending: true })
    if (data && data.length > 0) {
      messages.value = data as RadarRoomMessage[]
      // 同步到本地缓存
      data.forEach((m: RadarRoomMessage) => store.addRadarMessage(m))
      await nextTick()
      scrollToBottom()
    }
  } catch (e) {
    console.warn('loadMessages failed:', e)
  }
}

function scrollToBottom() {
  if (messageListEl.value) {
    messageListEl.value.scrollTop = messageListEl.value.scrollHeight
  }
}

async function tryJoin() {
  if (!room.value) return
  const inputPw = passwordInput.value.trim()
  // v0.10（2026-10-03）：密码存储为哈希，比对前先哈希输入
  const ok = await verifyRoomPassword(inputPw, room.value.password)
  if (!inputPw || !ok) {
    passwordError.value = '密码不对'
    return
  }
  needPassword.value = false
  passwordError.value = ''
  joined.value = true
  loadMessages()
}

async function sendMessage() {
  const rawText = messageText.value.trim()
  if (!rawText || !store.currentUser || !room.value) return
  // v0.10.4（2026-10-05）：房间到期后禁止发送。
  // 【原缺陷】loadMessages 检查了到期，但 sendMessage 没检查 → 已到期房间仍可发消息。
  if (new Date(room.value.expires_at).getTime() <= Date.now()) {
    error.value = '房间已到期'
    return
  }
  const text = rawText.slice(0, 240).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))

  // 断网检测：离线时禁止发送，提示
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    offlineWarn.value = true
    return
  }

  const msg: RadarRoomMessage = {
    id: crypto.randomUUID(),
    room_id: room.value.id,
    sender_id: store.currentUser.id,
    content: text,
    created_at: new Date().toISOString(),
    status: 'sending',
  }

  // 本地立即显示 + 缓存到 store（乐观 UI）
  messages.value = [...messages.value, msg]
  store.addRadarMessage(msg)
  messageText.value = ''
  await nextTick()
  scrollToBottom()

  // v0.9.18 p1 修复：发送后强制让 input 保持焦点（不收起手机输入法）
  await nextTick()
  msgInputEl.value?.focus()

  // 远程保存（v0.9.23.4：成功 → sent，失败 → failed + 可重发）
  // v0.10 修复（2026-10-03）：status 是【本地瞬时 UI 状态】，不能落库。
  //
  // 【原缺陷】v0.9.23.4 把 status 一起 insert，但 radar_room_messages
  // 表并无 status 列（无对应迁移）→ PostgREST 返回 PGRST204 → insErr 有值
  // → 消息被标为 failed → 红色感叹号。表现为「联网发消息也显示感叹号」。
  //
  // 剥离而非加列的理由（第一性原理）：
  //   1. sending/sent/failed 只对【发送方本人】有意义，是瞬时状态；
  //   2. 若落库，他人拉取时会看到早已发送成功的消息仍显示「发送中」；
  //   3. loadMessages() 用远程数据覆盖 messages.value，落库的状态也会被冲掉。
  // 因此 status 只存在于本地，不参与持久化。
  const { status: _localStatus, ...persistable } = msg
  try {
    const { error: insErr } = await supabase.from('radar_room_messages').insert(persistable)
    const ok = !insErr
    updateMessageStatus(msg.id, ok ? 'sent' : 'failed')
    if (!ok) {
      console.warn('sendMessage insert error:', insErr?.message)
      // 只有真正离线时才提示网络异常；列/约束类错误不应误导为用户断网
      if (typeof navigator !== 'undefined' && !navigator.onLine) offlineWarn.value = true
    }
  } catch (e) {
    console.warn('sendMessage failed:', e)
    updateMessageStatus(msg.id, 'failed')
    offlineWarn.value = true
  }
}

// v0.9.23.4：更新本地消息状态（发送中 → 已发送 / 失败）
function updateMessageStatus(id: string, status: 'sent' | 'failed') {
  messages.value = messages.value.map(m => m.id === id ? { ...m, status } : m)
  const storeIdx = store.radarRoomMessages.findIndex(m => m.id === id)
  if (storeIdx >= 0) {
    store.radarRoomMessages[storeIdx] = { ...store.radarRoomMessages[storeIdx], status }
  }
}

// v0.9.23.4：失败重发
// v0.10 修复（2026-10-03）：同样剥离本地瞬时字段 status（同 sendMessage 注释）
async function retryMessage(m: RadarRoomMessage) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    offlineWarn.value = true
    return
  }
  updateMessageStatus(m.id, 'sending')
  const { status: _localStatus, ...persistable } = m
  try {
    const { error: insErr } = await supabase.from('radar_room_messages').insert(persistable)
    updateMessageStatus(m.id, insErr ? 'failed' : 'sent')
    if (insErr) {
      console.warn('retryMessage insert error:', insErr.message)
      if (typeof navigator !== 'undefined' && !navigator.onLine) offlineWarn.value = true
    }
  } catch (e) {
    console.warn('retryMessage failed:', e)
    updateMessageStatus(m.id, 'failed')
    offlineWarn.value = true
  }
}

// 退出房间（参与者）
function onLeaveClick() {
  showLeaveModal.value = true
}

function confirmLeave() {
  showLeaveModal.value = false
  // v0.10 修复（2026-10-03）：原先仅跳路由，不从 participants 摘除 → 数组只增不减
  if (room.value && store.currentUser) {
    void store.closeRadarRoom(room.value.id, false, store.currentUser.id)
  }
  router.push('/home#section-radar')
}

function cancelLeave() {
  showLeaveModal.value = false
}

// 解散房间
function onDissolveClick() {
  if (!room.value || !isInitiator.value) return
  // v0.10.4（2026-10-04）：解散一律二次确认（用户要求）。
  // 【原缺陷】「只有房主一人则直接解散」会绕过确认 → 误触即散，已移除。
  // 【原缺陷】v0.10 之前用 onlineCount - 1 判断，而 onlineCount 恒为 1 → 弹窗永不触发。
  const otherCount = room.value.participants?.length || 0
  dissolveConfirmText.value = otherCount > 0
    ? `房间还有其他 ${otherCount} 名用户，你确认要解散同窗会吗？`
    : '你确认要解散同窗会吗？'
  showDissolveModal.value = true
}

async function doDissolve() {
  if (!room.value) return
  showDissolveModal.value = false
  await store.closeRadarRoom(room.value.id, true)
  // v0.9.23.2：不再 alert，路由跳转即告知
  router.push('/home#section-radar')
}

function cancelDissolve() {
  showDissolveModal.value = false
}

async function leaveRoom() {
  if (!room.value) {
    router.push('/home#section-radar')
    return
  }
  if (isInitiator.value) {
    await store.closeRadarRoom(room.value.id, true)
  } else if (store.currentUser) {
    await store.closeRadarRoom(room.value.id, false, store.currentUser.id)
  }
  router.push('/home#section-radar')
}

// 分享人设卡
function shareCard() {
  if (!store.currentUser || !room.value) return
  const cardText = `[人设卡] ${store.currentUser.cn || '匿名'} | ${store.currentUser.identity_tags?.join('、') || ''}`
  messageText.value = cardText
}

const formatTimeLeft = (expiresAt: string): string => {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '已到期'
  const totalSeconds = Math.floor(ms / 1000)
  const min = Math.floor(totalSeconds / 60)
  const sec = totalSeconds % 60
  
  // 1分钟内读秒
  if (totalSeconds < 60) {
    return `${sec}s`
  }
  if (min < 60) {
    return `剩 ${min} 分钟`
  }
  const h = Math.floor(min / 60)
  return `剩 ${h} 小时`
}
</script>

<template>
  <div class="rr-page">
    <header class="rr-header">
      <button @click="goBack" class="rr-back">←</button>
      <div class="rr-title-area">
        <div class="rr-host-name">
          {{ initiator ? maskName(initiator.cn, initiator.gender, initiator.hide_name) : '?' }}
        </div>
        <div class="rr-meta">
          <span v-if="room">{{ formatTimeLeft(room.expires_at) }}</span>
          <span v-if="isInitiator" class="rr-badge">房主</span>
          <span class="rr-online">{{ participantCount }}人参与</span>
        </div>
      </div>
      <!-- 房主解散按钮 / 参与者退出按钮 -->
      <button v-if="isInitiator" @click="onDissolveClick" class="rr-dissolve-btn">解散</button>
      <button v-else @click="onLeaveClick" class="rr-dissolve-btn">退出</button>
    </header>

    <!-- 密码门 -->
    <div v-if="needPassword && !joined" class="password-gate">
      <p class="gate-msg">这是一个私人房间</p>
      <input
        v-model="passwordInput"
        type="text"
        class="gate-input"
        placeholder="输入密码"
        maxlength="6"
      />
      <p v-if="passwordError" class="gate-error">{{ passwordError }}</p>
      <button @click="tryJoin" class="gate-btn">进入</button>
    </div>

    <!-- 已进入：展示 4 要求 + 聊天 -->
    <template v-else-if="room && joined">
      <!-- v0.9.23.4：断网提示 -->
      <div v-if="offlineWarn" class="offline-banner">
        <span class="offline-icon">⚠</span>
        <span class="offline-text">网络异常，消息可能未发送成功</span>
        <button class="offline-retry" @click="offlineWarn = false">知道了</button>
      </div>

      <section class="rr-intents">
        <div v-if="room.intent_want.length" class="intent-block">
          <span class="intent-label">希望</span>
          <div class="intent-chips">
            <span v-for="t in room.intent_want" :key="t" class="intent-chip">{{ t }}</span>
          </div>
        </div>
        <div v-if="room.intent_provide.length" class="intent-block">
          <span class="intent-label provide">提供</span>
          <div class="intent-chips">
            <span v-for="t in room.intent_provide" :key="t" class="intent-chip">{{ t }}</span>
          </div>
        </div>
        <div class="intent-block">
          <span class="intent-label location">地点</span>
          <span class="intent-text">{{ room.location }}</span>
        </div>
      </section>

      <div ref="messageListEl" @click="onMessagesAreaClick" class="rr-messages">
        <EmptyState
          v-if="messages.length === 0"
          emoji=""
          title="还没有消息"
          desc="说点什么吧"
          variant="compact"
        />
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg-row"
          :class="{ 'msg-mine': m.sender_id === store.currentUser?.id }"
          @click="m.status === 'failed' && m.sender_id === store.currentUser?.id ? retryMessage(m) : null"
        >
          <div class="msg-bubble">
            {{ m.content }}
            <!-- v0.9.23.4：发送状态角标（sending 转圈 / failed 感叹号可重发） -->
            <span
              v-if="m.sender_id === store.currentUser?.id && m.status"
              class="msg-status"
              :class="'msg-status-' + m.status"
              :title="m.status === 'failed' ? '发送失败，点击重发' : ''"
            >
              <span v-if="m.status === 'sending'" class="msg-status-spin"></span>
              <span v-else-if="m.status === 'failed'">!</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="rr-input-area">
        <button @click="shareCard" class="card-share-btn" title="分享人设卡">分享卡片</button>
        <input
          ref="msgInputEl"
          v-model="messageText"
          @keydown.enter.prevent="sendMessage"
          type="text"
          class="msg-input"
          placeholder="输入消息..."
        />
        <!-- v0.9.18 p1：mousedown.prevent 阻止 button click 让 input blur，保持键盘打开 -->
        <button @mousedown.prevent @click="sendMessage" :disabled="!messageText.trim()" class="msg-send">发送</button>
      </div>
    </template>

    <!-- 房间不存在 -->
    <div v-if="!room" class="rr-not-found">
      <p>房间不存在或已解散</p>
      <button @click="router.push('/home#section-radar')" class="gate-btn">返回同窗会</button>
    </div>
    <p v-else-if="error" class="error-msg">{{ error }}</p>

    <!-- 解散同窗会弹窗（v0.10.4：二次确认，确认=红 / 取消=灰） -->
    <div v-if="showDissolveModal" class="modal-overlay" @click.self="cancelDissolve">
      <div class="modal-content modal-dissolve">
        <div class="modal-icon">解散</div>
        <p class="modal-title">解散同窗会</p>
        <p class="modal-text">{{ dissolveConfirmText }}</p>
        <div class="modal-actions">
          <button @click="cancelDissolve" class="modal-btn modal-btn-cancel">取消</button>
          <button @click="doDissolve" class="modal-btn modal-btn-confirm">确认</button>
        </div>
      </div>
    </div>

    <!-- 退出确认弹窗（参与者） -->
    <div v-if="showLeaveModal" class="modal-overlay" @click.self="cancelLeave">
      <div class="modal-content modal-dissolve">
        <div class="modal-icon">退出</div>
        <p class="modal-title">退出同窗会</p>
        <p class="modal-text">确认退出同窗会吗？</p>
        <div class="modal-actions">
          <button @click="cancelLeave" class="modal-btn modal-btn-cancel">取消</button>
          <button @click="confirmLeave" class="modal-btn modal-btn-confirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rr-page {
  min-height: 100vh;
  background: #f5f1e8;
  display: flex;
  flex-direction: column;
}
.rr-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #ffffff;
  border-bottom: 1px solid #f0ede5;
}
.rr-back {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 0;
}
.rr-title-area {
  flex: 1;
}
.rr-host-name {
  font-size: 16px;
  font-weight: 600;
  color: #2b2a26;
}
.rr-meta {
  font-size: 12px;
  color: #8c8780;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rr-badge {
  padding: 1px 6px;
  background: #2b2a26;
  color: #fff5dc;
  border-radius: 8px;
  font-size: 10px;
}
.rr-online {
  font-size: 11px;
  color: #4a9b5e;
}
.rr-dissolve-btn {
  padding: 6px 14px;
  background: #c44545;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}
.rr-dissolve-btn:hover {
  background: #a83535;
}
.password-gate {
  max-width: 320px;
  margin: 60px auto;
  text-align: center;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #f0ede5;
}
.gate-msg {
  font-size: 14px;
  color: #5c5953;
  margin: 0 0 16px;
}
.gate-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
  letter-spacing: 4px;
  margin-bottom: 8px;
  box-sizing: border-box;
}
.gate-error {
  color: #c44545;
  font-size: 12px;
  margin: 0 0 8px;
}
.gate-btn {
  width: 100%;
  padding: 10px;
  background: #2b2a26;
  color: #fff5dc;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.rr-intents {
  background: #ffffff;
  margin: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #f0ede5;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.intent-block {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.intent-label {
  font-size: 11px;
  padding: 2px 8px;
  background: #f0ede5;
  color: #5c4d2e;
  border-radius: 8px;
  flex-shrink: 0;
}
.intent-label.provide {
  background: #fff5dc;
  color: #8b5a3c;
}
.intent-label.location {
  background: #2b2a26;
  color: #fff5dc;
}
.intent-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.intent-chip {
  font-size: 11px;
  padding: 2px 8px;
  background: #fafaf8;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  color: #5c5953;
}
.intent-text {
  font-size: 13px;
  color: #2b2a26;
}
.rr-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 200px;
}
.msg-row {
  display: flex;
}
.msg-row.msg-mine {
  justify-content: flex-end;
}
.msg-bubble {
  max-width: 70%;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e8e6e1;
  border-radius: 12px;
  font-size: 14px;
  color: #2b2a26;
}
.msg-row.msg-mine .msg-bubble {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}
/* v0.9.23.4：消息发送状态角标 */
.msg-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  font-size: 12px;
  vertical-align: middle;
}
.msg-status-failed {
  color: #ff6b6b;
  font-weight: 700;
}
.msg-status-spin {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff5dc;
  border-radius: 50%;
  animation: msgSpin 0.8s linear infinite;
}
@keyframes msgSpin {
  to { transform: rotate(360deg); }
}
/* v0.9.23.4：断网 banner */
.offline-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin: 12px;
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
.rr-input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border-top: 1px solid #f0ede5;
  align-items: center;
}
.card-share-btn {
  padding: 8px 12px;
  background: none;
  border: 1px solid #e8e6e1;
  border-radius: 18px;
  font-size: 12px;
  color: #6d6d72;
  cursor: pointer;
  flex-shrink: 0;
}
.msg-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 18px;
  font-size: 14px;
  outline: none;
}
.msg-send {
  padding: 8px 16px;
  background: #2b2a26;
  color: #fff5dc;
  border: none;
  border-radius: 18px;
  font-size: 13px;
  cursor: pointer;
}
.msg-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rr-not-found {
  margin: 80px auto;
  text-align: center;
  padding: 0 20px;
}
.error-msg {
  color: #c44545;
  font-size: 13px;
  text-align: center;
  margin: 12px 0;
}

.rr-not-found p {
  color: #8c8780;
  margin-bottom: 16px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  max-width: 320px;
  width: 90%;
  text-align: center;
}
.modal-text {
  font-size: 15px;
  color: #2b2a26;
  margin: 0 0 20px;
  line-height: 1.5;
}
/* v0.9.23.2：MUJI 风格单 OK 弹窗（解散/退出提示） */
.modal-dissolve {
  border-radius: 4px;
  background: #fff;
  padding: 28px 24px 20px;
  border: 1px solid #eee;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.modal-dissolve .modal-icon {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #8c8780;
  background: #f4eede;
  border: 1px solid #e8e1cd;
  border-radius: 4px;
  padding: 3px 10px;
  margin-bottom: 14px;
  letter-spacing: 0;
}
.modal-dissolve .modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0 0 8px;
  letter-spacing: 0;
}
.modal-dissolve .modal-text {
  font-size: 13px;
  color: #5c5953;
  margin: 0 0 20px;
  line-height: 1.6;
}
.modal-ok {
  display: block;
  width: 100%;
  padding: 12px;
  background: #3c3c43;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  letter-spacing: 0;
}
.modal-ok:active {
  background: #2b2a26;
}
.modal-actions {
  display: flex;
  gap: 12px;
}
/* v0.9.23.3：MUJI 风格双按钮（取消 + 确认） */
.modal-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  letter-spacing: 0;
  font-family: inherit;
}
/* v0.10.4：取消=灰（次要）、确认=红（危险操作语义） */
.modal-btn-cancel {
  background: #e8e6e1;
  color: #5c5953;
  border: 1px solid #e8e6e1;
}
.modal-btn-cancel:active {
  background: #dcd8d0;
  border-color: #dcd8d0;
}
.modal-btn-confirm {
  background: #c44545;
  color: #ffffff;
  border: 1px solid #c44545;
}
.modal-btn-confirm:active {
  background: #a83535;
  border-color: #a83535;
}
.modal-confirm {
  flex: 1;
  padding: 12px;
  background: #2b2a26;
  color: #fff5dc;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}
.modal-cancel {
  flex: 1;
  padding: 12px;
  background: #ffffff;
  color: #2b2a26;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}

/* kz-name-mask 黑块（昵称隐私） */
:deep(.kz-name-mask) {
  background: #1a1a1a;
  color: #1a1a1a;
  padding: 0 2px;
  border-radius: 2px;
  letter-spacing: 0;
  user-select: none;
}
</style>
