<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { useAlertStore } from '../stores/alert'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useKizunaStore()
const alert = useAlertStore()

/** Realtime: 有人在这个对话里发新消息时自动 load */
function handleNewMessage(e: any) {
  const m = e.detail
  if (m.conversation_id !== conversationId.value) return
  loadMessages()
}

onMounted(() => {
  loadMessages()
  store.subscribeRealtime()
  window.addEventListener('kizuna:new-message', handleNewMessage as any)
})

onBeforeUnmount(() => {
  window.removeEventListener('kizuna:new-message', handleNewMessage as any)
})

watch(conversationId, (v) => {
  if (v) loadMessages()
})

const requestId = computed(() => {
  const id = route.params.requestId
  return typeof id === 'string' ? id : ''
})
const request = computed(() => store.requests.find(r => r.id === requestId.value))

/** 对方（当前 user 视角下与我对谈的人） */
const peer = computed(() => {
  if (!request.value || !store.currentUserId) return null
  return store.currentUserId === request.value.owner_id
    ? request.value.requester
    : { id: request.value.owner_id }
})

// 直接从 users 表查完整对方
const peerFull = computed(() =>
  peer.value?.id ? store.getUserById(peer.value.id) : null
)

const isAccepted = computed(() => request.value?.status === 'accepted')

// P0-C C2: 临时聊天状态
const convScope = computed(() => {
  if (messages.value.length > 0 && messages.value[0].scope === 'temporary') return 'temporary'
  if (isAccepted.value) return 'persistent'
  return 'temporary'
})
const venueName = computed(() => {
  const m = messages.value.find((x: any) => x.scope_id)
  // hardening: venue_name 不在 Message 类型中，使用 scope_id 查询 venues
  return m?.venue_name || store.venues.find(v => v.id === m?.scope_id)?.name || null
})
const venueEnded = computed(() => {
  const m = messages.value.find((x: any) => x.scope_id)
  if (!m?.scope_id) return false
  // hardening: venue_ends_at 不在 Message 类型中，从 venues 查
  const venue = store.venues.find(v => v.id === m.scope_id)
  const endsAt = venue?.end_at || m?.venue_ends_at
  if (!endsAt) return false
  const d = new Date(endsAt)
  return !isNaN(d.getTime()) && d < new Date()
})
const showUpgradeBtn = computed(() => isAccepted.value || venueEnded.value)
async function upgradeToFriend() {
  if (!(await alert.confirm('成为新朋友吧！', '升级后聊天记录将保留'))) return
  alert.info('已链接', '成为新朋友啦')
}

const conversationId = computed(() => request.value?.conversation_id || null)

const messages = ref<any[]>([])
const draft = ref('')
const sending = ref(false)

async function loadMessages() {
  if (!conversationId.value) return
  messages.value = await store.fetchMessages(conversationId.value)
}

async function acceptRequest() {
  if (!requestId.value) return
  const ok = await store.acceptRequest(requestId.value)
  if (ok) {
    alert.success('已接受', '现在可以开始对话了')
    await loadMessages()
  } else {
    alert.error('接受失败', store.error || '未知错误')
  }
}

async function declineRequest() {
  if (!requestId.value) return
  const ok = await store.declineRequest(requestId.value)
  if (ok) {
    alert.info('已拒绝', '本次申请不会进入对话列表')
    router.back()
  }
}

async function send() {
  if (!conversationId.value) return
  const text = draft.value.trim().slice(0, 240)
  if (!text) return
  sending.value = true
  const ok = await store.sendMessage(conversationId.value, text)
  sending.value = false
  if (ok) {
    draft.value = ''
    await loadMessages()
  } else {
    alert.error('发送失败', store.error || '网络异常')
  }
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  return d.toLocaleDateString('zh-CN')
}

function back() { router.back() }
</script>

<template>
  <div class="cv-page">
    <!-- Top -->
    <header class="cv-header">
      <button class="cv-back" @click="back">←</button>
      <div v-if="peerFull" class="cv-peer">
        <img :src="peerFull.avatar_url" :alt="peerFull.cn" class="cv-peer-avatar" />
        <div class="cv-peer-info">
          <div class="cv-peer-cn">{{ peerFull.cn }}</div>
          <div class="cv-peer-meta">
            {{ peerFull.gender === 'male' ? '男' : peerFull.gender === 'female' ? '女' : '保密' }}
            <span v-if="peerFull.activity_area"> · {{ peerFull.activity_area }}</span>
          </div>
        <div v-if="convScope === 'temporary'" class="cv-scope-badge cv-scope-temp">
          临时聊天 · {{ venueName || '漫展限定' }}
        </div>
        <div v-else-if="convScope === 'persistent'" class="cv-scope-badge cv-scope-persist">
          好友
        </div>
        </div>
      </div>
      <div v-else class="cv-peer">
        <div class="cv-peer-info">
          <div class="cv-peer-cn">对方</div>
        </div>
      </div>
    </header>

    <!-- Status banner -->
    <div v-if="request && !isAccepted" class="cv-status">
      <div v-if="request.status === 'pending'">
        <p class="cv-status-msg">
          {{ request.requester_id === store.currentUserId ? '已发送请求，等待 TA 接受' : '想认识你' }}
        </p>
        <p v-if="request.message" class="cv-status-quote">"{{ request.message }}"</p>
        <!-- 对方看到 pending → 自己 accept -->
        <div v-if="request.owner_id === store.currentUserId" class="cv-actions">
          <button class="btn-accept" @click="acceptRequest">接受</button>
          <button class="btn-decline" @click="declineRequest">拒绝</button>
        </div>
      </div>
      <div v-else-if="request.status === 'declined'" class="cv-status-declined">
        <p>本次申请已被拒绝</p>
      </div>
    </div>

    <!-- Messages timeline -->
    <div v-if="isAccepted && conversationId" class="cv-messages">
      <EmptyState
        v-if="messages.length === 0"
        emoji=""
        title="还没有消息"
        desc=""
        variant="compact"
      />
      <div
        v-for="m in messages"
        :key="m.id"
        class="msg"
        :class="{ 'msg-mine': m.sender_id === store.currentUserId }"
      >
        <div class="msg-bubble">{{ m.body }}</div>
        <div class="msg-time">{{ timeAgo(m.created_at) }}</div>
      </div>
    </div>

    <!-- Contact card (after accepted) -->
    <div v-if="isAccepted && peerFull && peerFull.contact && Object.keys(peerFull.contact).length" class="cv-contact">
      <div class="cv-contact-title">TA的联系方式</div>
      <div class="cv-contact-grid">
        <div v-if="peerFull.contact.phone" class="cv-contact-row">
          <span class="cv-contact-key">手机</span>
          <span class="cv-contact-val">{{ peerFull.contact.phone }}</span>
        </div>
        <div v-if="peerFull.contact.wechat" class="cv-contact-row">
          <span class="cv-contact-key">微信</span>
          <span class="cv-contact-val">{{ peerFull.contact.wechat }}</span>
        </div>
        <div v-if="peerFull.contact.qq" class="cv-contact-row">
          <span class="cv-contact-key">QQ</span>
          <span class="cv-contact-val">{{ peerFull.contact.qq }}</span>
        </div>
        <div v-if="peerFull.contact.email" class="cv-contact-row">
          <span class="cv-contact-key">邮箱</span>
          <span class="cv-contact-val">{{ peerFull.contact.email }}</span>
        </div>
      </div>
    </div>

    <!-- Compose -->
    <div v-if="isAccepted && conversationId" class="cv-compose">
      <textarea
        v-model="draft"
        class="cv-input"
        placeholder="魔法书里可没教这个"
        rows="2"
        @keydown.enter.exact.prevent="send"
      />
      <button
        class="cv-send"
        :disabled="sending || !draft.trim()"
        @click="send"
      >
        {{ sending ? '...' : '发送' }}
      </button>
    </div>

    <!-- P0-C: 升级按钮 + 活动结束 banner -->
      <div v-if="convScope === 'temporary' && showUpgradeBtn" class="cv-upgrade-zone">
        <button class="btn-upgrade-friend" @click="upgradeToFriend">升级为好友</button>
        <div class="cv-upgrade-hint"></div>
      </div>
      <div v-if="convScope === 'temporary' && venueEnded" class="cv-ended-banner">
        <div class="cv-ended-text">
          <strong>{{ venueName || '漫展' }}</strong>已结束
          <div class="cv-ended-sub">点击上方"成为新朋友吧！"可保留聊天记录</div>
        </div>
      </div>
      <div class="safe-bottom" />
  </div>
</template>

<style scoped>
.cv-page {
  min-height: 100vh;
  background: #fafaf8;
  display: flex;
  flex-direction: column;
  padding: 16px 0 0;
}

.cv-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px 14px;
  background: #ffffff;
  border-bottom: 1px solid #f0ede5;
}

.cv-back {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.cv-peer {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.cv-peer-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.cv-peer-cn {
  font-size: 15px;
  font-weight: 600;
  color: #2b2a26;
}

.cv-peer-meta {
  font-size: 11px;
  color: #a8a39a;
}

/* Status banner (pre-accept) */
.cv-status {
  background: #fffbf2;
  border: 1px solid #f0ede5;
  border-radius: 14px;
  margin: 14px;
  padding: 14px;
}

.cv-status-msg {
  font-size: 13px;
  color: #5c4d2e;
  margin: 0;
  font-weight: 500;
}

.cv-status-quote {
  font-size: 13px;
  color: #2b2a26;
  margin: 8px 0 12px;
  padding: 8px 12px;
  background: #fff5dc;
  border-radius: 10px;
  border-left: 3px solid #b8ad95;
  line-height: 1.5;
}

.cv-status-declined p {
  font-size: 13px;
  color: #a87f4a;
  text-align: center;
  margin: 0;
}

.cv-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-accept {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn-decline {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  background: transparent;
  color: #a8a39a;
  font-size: 13px;
  border: 1px solid #e8e6e1;
  cursor: pointer;
}

/* Messages */
.cv-messages {
  flex: 1;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 320px;
}

.cv-empty {
  text-align: center;
  font-size: 13px;
  color: #a8a39a;
  padding: 32px 0;
}

.msg {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  align-self: flex-start;
}

.msg-mine {
  align-self: flex-end;
  align-items: flex-end;
}

.msg-bubble {
  background: #ffffff;
  color: #2b2a26;
  padding: 9px 13px;
  border-radius: 14px 14px 14px 4px;
  border: 1px solid #f0ede5;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.msg-mine .msg-bubble {
  background: #2b2a26;
  color: #fff5dc;
  border-radius: 14px 14px 4px 14px;
  border-color: #2b2a26;
}

.msg-time {
  font-size: 10px;
  color: #c0bbb0;
  margin-top: 3px;
  padding: 0 4px;
}

/* Contact card */
.cv-contact {
  background: #ffffff;
  border-top: 1px solid #f0ede5;
  margin: 0;
  padding: 12px 14px;
}

.cv-contact-title {
  font-size: 12px;
  font-weight: 700;
  color: #5c5953;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.cv-contact-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cv-contact-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}

.cv-contact-key {
  color: #a8a39a;
  min-width: 36px;
  font-weight: 500;
}

.cv-contact-val {
  color: #2b2a26;
  font-family: ui-monospace, monospace;
}

/* Compose */
.cv-compose {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  background: #ffffff;
  border-top: 1px solid #f0ede5;
  align-items: flex-end;
}

.cv-input {
  flex: 1;
  border: 1px solid #e8e6e1;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 14px;
  font-family: inherit;
  background: #fafaf8;
  resize: none;
  outline: none;
  color: #2b2a26;
  transition: border-color 0.18s ease;
}

.cv-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.cv-send {
  padding: 8px 16px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cv-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.safe-bottom {
  height: 24px;
  background: #ffffff;
}
/* P0-C C2: 临时聊天样式 */
.cv-scope-badge { font-size: 11px; margin-top: 2px; padding: 2px 8px; border-radius: 8px; display: inline-block; }
.cv-scope-temp { background: rgba(255, 248, 235, 0.9); color: #8b7355; border: 1px solid #e8dcc4; }
.cv-scope-persist { background: rgba(255, 244, 220, 0.9); color: #8b5a3c; border: 1px solid #d4a574; }
.cv-scope-icon { font-size: 10px; margin-right: 2px; }
.cv-upgrade-zone { margin: 12px 16px 8px; text-align: center; }
.btn-upgrade-friend { width: 100%; padding: 12px; background: linear-gradient(135deg, #d4a574, #b8865a); color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn-upgrade-friend:active { opacity: 0.8; }
.cv-upgrade-hint { font-size: 11px; color: #8c8780; margin-top: 6px; }
.cv-ended-banner { margin: 12px 16px 8px; padding: 14px 16px; background: rgba(248, 245, 235, 0.9); border-radius: 12px; border: 1px dashed #d4a574; display: flex; align-items: center; gap: 12px; }
.cv-ended-icon { font-size: 22px; }
.cv-ended-text { font-size: 13px; color: #5c4a35; line-height: 1.5; }
.cv-ended-text strong { color: #8b5a3c; }
.cv-ended-sub { font-size: 11px; color: #8c8780; margin-top: 2px; }
</style>