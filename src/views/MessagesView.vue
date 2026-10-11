<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const route = useRoute()
const store = useKizunaStore()

type Tab = 'incoming' | 'outgoing' | 'chats' | 'declined'
const VALID_TABS: Tab[] = ['incoming', 'outgoing', 'chats', 'declined']
const tab = ref<Tab>('incoming')

// 支持 ?tab= 直达（如发完请求跳「想认识」tab）
function applyTabFromQuery() {
  const q = String(route.query.tab || '')
  if ((VALID_TABS as string[]).includes(q)) tab.value = q as Tab
}
applyTabFromQuery()
// query 变化时同步（router-view :key 为 path，query 变化不重建组件）
watch(() => route.query.tab, () => applyTabFromQuery())

// Realtime 新消息 / 新请求 提示
const newRequestHint = ref<string | null>(null)
const newMessageHint = ref<string | null>(null)

function handleNewRequest(e: any) {
  const req = e.detail
  const requesterName = req.requester?.cn || '有人'
  newRequestHint.value = `${requesterName} 向你发起了新请求`
  setTimeout(() => {
    newRequestHint.value = null
  }, 5000)
}

function handleNewMessage(e: any) {
  const m = e.detail
  if (m.sender_id === store.currentUserId) return
  const sender = store.getUserById(m.sender_id)
  const name = sender?.cn || '有人'
  newMessageHint.value = `${name} 来新消息了`
  setTimeout(() => {
    newMessageHint.value = null
  }, 5000)
}

onMounted(async () => {
  try {
    if (store.users.length === 0) await store.init()
    await store.fetchRequests()
  } catch (e) {
    console.error('[MessagesView] init failed:', e)
  }
  store.subscribeRealtime()
  window.addEventListener('kizuna:new-request', handleNewRequest as any)
  window.addEventListener('kizuna:new-message', handleNewMessage as any)
})

onBeforeUnmount(() => {
  window.removeEventListener('kizuna:new-request', handleNewRequest as any)
  window.removeEventListener('kizuna:new-message', handleNewMessage as any)
})

const isOwner = (r: any) => r.owner_id === store.currentUserId

/** pending 收到的 → incoming */
const incoming = computed(() =>
  store.myRequests.filter(r => r.status === 'pending' && isOwner(r))
)

/** pending 我发的 → outgoing */
const outgoing = computed(() =>
  store.myRequests.filter(r => r.status === 'pending' && !isOwner(r))
)

/** accepted → chats */
const chats = computed(() =>
  store.myRequests.filter(r => r.status === 'accepted')
)

/** declined */
const declined = computed(() =>
  store.myRequests.filter(r => r.status === 'declined' || r.status === 'cancelled')
)

const tabs: Array<{ key: Tab; label: string; count: number }> = [
  { key: 'incoming', label: '请求', count: 0 },
  { key: 'outgoing', label: '想认识', count: 0 },
  { key: 'chats', label: '对话', count: 0 },
  { key: 'declined', label: '拒绝', count: 0 },
]

const dynamicTabs = computed(() => [
  { key: 'incoming' as Tab, label: '请求', count: incoming.value.length },
  { key: 'outgoing' as Tab, label: '想认识', count: outgoing.value.length },
  { key: 'chats' as Tab, label: '对话', count: chats.value.length },
  { key: 'declined' as Tab, label: '拒绝', count: declined.value.length },
])

const currentList = computed(() => {
  if (tab.value === 'incoming') return incoming.value
  if (tab.value === 'outgoing') return outgoing.value
  if (tab.value === 'chats') return chats.value
  return declined.value
})

const emptyState = computed(() => {
  if (tab.value === 'incoming') return { icon: '', title: '没有新请求', desc: '有人在想认识你时会出现在这里' }
  if (tab.value === 'outgoing') return { icon: '', title: '还没有发出请求', desc: '在同好页面点「想认识 TA」会出现在这里' }
  if (tab.value === 'chats') return { icon: '', title: '还没有对话', desc: '对方的接受会出现在这里' }
  return { icon: '', title: '没有已拒绝的请求', desc: '' }
})

function open(r: any) {
  router.push(`/conversation/${r.id}`)
}

function timeAgo(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = Math.max(0, (now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + '天前'
  return d.getMonth() + 1 + '/' + d.getDate()
}

function peerName(r: any): string {
  const otherId = isOwner(r) ? r.requester?.cn : store.getUserById(r.owner_id)?.cn
  return otherId || '匿名'
}

function peerAvatar(r: any): string {
  const otherId = isOwner(r) ? r.requester_id : r.owner_id
  const u = store.getUserById(otherId)
  const url = u?.avatar_url
  return url && !String(url).includes('placehold.co') ? url : '/default-avatar.svg'
}
</script>

<template>
  <div class="msg-page">
    <div class="msg-shell">
      <div class="top-bar">
        <h1 class="page-title">消息</h1>
        <span v-if="incoming.length > 0" class="badge-num">
          {{ incoming.length }} 条新请求
        </span>
      </div>

      <!-- Tab 4-toggle -->
      <div class="tab-bar">
        <button
          v-for="t in dynamicTabs"
          :key="t.key"
          @click="tab = t.key"
          class="tab-chip"
          :class="{ 'tab-chip-active': tab === t.key }"
        >
          {{ t.label }}
          <span class="tab-count" v-if="t.count > 0">{{ t.count }}</span>
        </button>
      </div>

      <!-- Empty -->
      <!-- Realtime 提示 -->
      <Transition name="hint">
        <div v-if="newRequestHint" class="hint-banner hint-request">
          {{ newRequestHint }}
        </div>
      </Transition>
      <Transition name="hint">
        <div v-if="newMessageHint" class="hint-banner hint-message">
          {{ newMessageHint }}
        </div>
      </Transition>

      <div v-if="currentList.length === 0">
        <EmptyState
          :emoji="emptyState.icon"
          :title="emptyState.title"
          :desc="emptyState.desc"
          variant="compact"
        />
      </div>

      <!-- List -->
      <div v-else class="list">
        <button
          v-for="r in currentList"
          :key="r.id"
          class="msg-card"
          @click="open(r)"
        >
          <img :src="peerAvatar(r)" :alt="peerName(r)" class="msg-avatar" />
          <div class="msg-body">
            <div class="msg-row1">
              <span class="msg-name">{{ peerName(r) }}</span>
              <span class="msg-time">{{ timeAgo(r.created_at) }}</span>
            </div>
            <div class="msg-target">
              <span v-if="tab === 'chats'">已建立连接</span>
              <span v-else>关于「{{ r.listing?.title || '扩列' }}」</span>
            </div>
            <div class="msg-text">
              <span v-if="tab === 'chats'">
                <span v-if="r.requester_id === store.currentUserId">
                  已加你为好友，开始聊天
                </span>
                <span v-else>
                  你们已建立连接
                </span>
              </span>
              <span v-else>{{ r.message || '（无消息）' }}</span>
            </div>
          </div>
          <span class="msg-arrow">›</span>
        </button>
      </div>

      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.msg-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px 20px calc(80px + env(safe-area-inset-bottom));
}

.msg-shell {
  max-width: 480px;
  margin: 0 auto;
}

/* Realtime hint banner */
.hint-banner {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 10px;
  border: 1px solid;
  text-align: center;
}
.hint-request {
  background: #fff5dc;
  color: #5c4d2e;
  border-color: #f0e6b8;
}
.hint-message {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #bbdefb;
}
.hint-enter-active, .hint-leave-active {
  transition: opacity .25s ease, transform .25s ease;
}
.hint-enter-from, .hint-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.top-bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 0 4px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #2b2a26;
  letter-spacing: -0.02em;
}

.badge-num {
  font-size: 12px;
  padding: 3px 10px;
  background: #fff5dc;
  color: #5c4d2e;
  border-radius: 12px;
  font-weight: 500;
}

/* 4-tab */
.tab-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f0ede5;
  padding-bottom: 12px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e8e6e1;
  color: #5c5953;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;
}

.tab-chip-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

.tab-count {
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: #fff5dc;
  color: #5c4d2e;
  font-size: 10px;
  font-weight: 700;
  align-items: center;
  justify-content: center;
}

.tab-chip-active .tab-count {
  background: #b8ad95;
  color: #2b2a26;
}

/* Empty */
.empty {
  text-align: center;
  padding: 80px 20px;
}

.empty-icon {
  font-size: 56px;
  opacity: 0.5;
  margin-bottom: 14px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: #a8a39a;
  line-height: 1.5;
}

/* List */
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.msg-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #f0ede5;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
  align-items: center;
}

.msg-card:hover {
  border-color: #b8ad95;
  transform: translateY(-1px);
}

.msg-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.msg-body {
  flex: 1;
  min-width: 0;
}

.msg-row1 {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}

.msg-name {
  font-size: 14px;
  font-weight: 600;
  color: #2b2a26;
}

.msg-time {
  font-size: 11px;
  color: #a8a39a;
  font-weight: 400;
}

.msg-target {
  font-size: 12px;
  color: #5c4d2e;
  margin-bottom: 4px;
  font-weight: 500;
}

.msg-text {
  font-size: 13px;
  color: #5c5953;
  line-height: 1.5;
  word-break: break-word;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.msg-arrow {
  font-size: 20px;
  color: #c0bbb0;
}

.safe-bottom {
  height: 24px;
}
</style>