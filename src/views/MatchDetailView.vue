<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { useAlertStore } from '../stores/alert'
import { scoreMatch } from '../lib/matching'
import { hashVirtualId } from '../lib/virtualId'

const route = useRoute()
const alertStore = useAlertStore()
const router = useRouter()
const store = useKizunaStore()

const rawUserId = computed(() => route.params.userId as string)
const userId = computed(() => {
  const id = rawUserId.value
  if (!id || typeof id !== 'string') return ''
  return id
})

onMounted(async () => {
  if (store.users.length === 0) await store.init()
})

const other = computed(() => store.getUserById(userId.value))
const score = computed(() => {
  if (!other.value || !store.currentUser) return null
  return scoreMatch(store.currentUser as any, other.value as any)
})

// 申请状态
const sending = ref(false)
const sent = ref(false)
const showForm = ref(false)
const message = ref('')

// 意图互补分析
const intentMatch = computed(() => {
  if (!other.value || !store.currentUser) return null
  const me = store.currentUser as any
  const them = other.value as any

  const iProvide = new Set(me.intent_provide || [])
  const youWant = new Set([...(them.intent_want_do || []), ...(them.intent_want_meet || [])])
  const iWant = new Set([...(me.intent_want_do || []), ...(me.intent_want_meet || [])])
  const youProvide = new Set(them.intent_provide || [])

  const giveYou = Array.from(youWant).filter(x => iProvide.has(x))
  const youGiveMe = Array.from(iWant).filter(x => youProvide.has(x))

  return { giveYou, youGiveMe }
})

const existingRequest = computed(() => {
  if (!store.currentUserId) return null
  return store.requests.find(r =>
    (r.requester_id === store.currentUserId && r.owner_id === userId.value) ||
    (r.requester_id === userId.value && r.owner_id === store.currentUserId)
  )
})

async function sendRequest() {
  if (!store.currentUserId) {
    if (await alertStore.confirm('还没创建你的卡，先创建吗？')) {
      router.push('/editor')
    }
    return
  }
  const msg = message.value.trim().slice(0, 120) || '想认识你！'
  sending.value = true
  const r = await store.createRequest(userId.value, msg)
  sending.value = false
  if (r) {
    sent.value = true
    showForm.value = false
  }
}

function goToMessages() {
  router.push('/messages')
}
// P0-C C1: 4 层可见度状态
const shareLevel = ref(0) // 0=L0 模糊, 1=L1 已分享, 2=L2 联系方式授权
const accessLabel = computed(() => {
  if (shareLevel.value === 2) return '已获得完整访问权'
  if (shareLevel.value === 1) return '已分享对方查看'
  return '仅模糊摘要'
})
const accessColor = computed(() => {
  if (shareLevel.value === 2) return '#8b5a3c'
  if (shareLevel.value === 1) return '#a67c52'
  return '#8c8780'
})
const otherVirtualId = computed(() => {
  if (!other.value) return ''
  return hashVirtualId(other.value.id)
})
const otherFuzzyTags = computed(() => {
  // L0: 显示模糊维度标签（不暴露具体内容）
  if (!score.value?.reasons) return []
  return score.value.reasons.slice(0, 3).map((r: string) => r.replace(/\d+/g, '×'))
})
const alreadySharedMe = ref(false) // 模拟：是否已分享我的卡片给对方

async function shareMyCardToOther() {
  if (!(await alertStore.confirm(
    `分享我的卡片给 ${other.value?.cn || 'TA'}？`,
    `对方将看到：CN/昵称、MBTI/星座、性别、活动地区、兴趣（C 态）、意图摘要`,
  ))) return
  shareLevel.value = 1
  alertStore.success('已分享 ')
}

async function requestContact() {
  if (shareLevel.value < 1) {
    alertStore.warn('请先分享你的卡片给对方')
    return
  }
  if (!(await alertStore.confirm('申请联系方式？', '对方同意后双向可见'))) return
  shareLevel.value = 2
  alertStore.success('已发送申请，等待对方同意')
}

</script>

<template>
  <div class="md-page" v-if="other && score">
    <div class="top-bar">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="page-title">TA 的卡片</h1>
      <div style="width: 24px"></div>
    </div>

    <!-- P0-C C1: 4 层可见度摘要条 -->
    <div class="md-access-bar" :style="{ borderColor: accessColor }">
      <div class="md-access-vid">虚拟 {{ otherVirtualId }}</div>
      <div class="md-access-level" :style="{ color: accessColor }">{{ accessLabel }}</div>
      <div v-if="shareLevel === 0" class="md-access-actions">
        <button class="btn-share-card" @click="shareMyCardToOther">分享我的卡片</button>
      </div>
      <div v-else-if="shareLevel === 1" class="md-access-actions">
        <button class="btn-request-contact" @click="requestContact">申请联系方式</button>
      </div>
      <div v-else class="md-access-actions">
        <span class="md-access-granted">已授权</span>
      </div>
    </div>

    <!-- P0-C C1: L0 模糊维度标签（仅 L0 显示） -->
    <div v-if="shareLevel === 0 && otherFuzzyTags.length > 0" class="md-fuzzy-tags">
      <div class="md-fuzzy-title">同窗会共同点（模糊）</div>
      <div class="md-fuzzy-list">
        <span v-for="tag in otherFuzzyTags" :key="tag" class="md-fuzzy-chip">{{ tag }}</span>
      </div>
      <div class="md-fuzzy-hint">分享你的卡片后可看到具体内容</div>
    </div>

    <div class="md-shell">
      <!-- Score banner -->
      <div class="score-banner">
        <div class="score-circle">
          <div class="score-big">{{ score.total }}</div>
          <div class="score-tag">匹配度</div>
        </div>
        <div class="score-info">
          <h2 class="other-name">{{ other.cn }}</h2>
          <p class="other-meta">
            <template v-if="shareLevel >= 1">
              <span>
                {{
                  other.gender === 'male' ? '男' :
                  other.gender === 'female' ? '女' : '保密'
                }}
              </span>
              <span v-if="other.activity_area">· {{ other.activity_area }}</span>
            </template>
            <span v-else class="other-meta-locked">🔒 分享卡片后查看完整资料</span>
          </p>
        </div>
      </div>

      <!-- L0 解锁提示 -->
      <div v-if="shareLevel === 0" class="md-locked-hint">
        <p class="md-locked-title">🔒 先打个招呼</p>
        <p class="md-locked-sub">分享你的卡片，即可查看 TA 的完整资料与共同点</p>
      </div>

      <!-- Reasons -->
      <section v-if="shareLevel >= 1 && score.reasons.length > 0" class="reasons-card">
        <h3 class="section-title">为什么匹配</h3>
        <div class="reason-list">
          <div v-for="(r, idx) in score.reasons" :key="idx" class="reason-item">
            {{ r }}
          </div>
        </div>
      </section>

      <!-- 意图互补卡片 -->
      <section v-if="shareLevel >= 1 && intentMatch && (intentMatch.giveYou.length || intentMatch.youGiveMe.length)" class="intent-match-card">
        <h3 class="section-title">你们可以互换</h3>
        <div v-if="intentMatch.giveYou.length" class="intent-match-row">
          <div class="im-label">TA 想要</div>
          <div class="im-chips">
            <span v-for="t in intentMatch.giveYou" :key="'gy-'+t" class="im-chip im-chip-them">{{ t }}</span>
          </div>
        </div>
        <div v-if="intentMatch.giveYou.length" class="im-arrow-row">
          <span class="im-arrow-text">↑ 你能提供</span>
        </div>
        <div v-if="intentMatch.youGiveMe.length" class="intent-match-row">
          <div class="im-label">你想要</div>
          <div class="im-chips">
            <span v-for="t in intentMatch.youGiveMe" :key="'ym-'+t" class="im-chip im-chip-me">{{ t }}</span>
          </div>
        </div>
        <div v-if="intentMatch.youGiveMe.length" class="im-arrow-row">
          <span class="im-arrow-text">↑ TA 能提供</span>
        </div>
      </section>

      <!-- Profile card preview -->
      <article v-if="shareLevel >= 1" class="profile-card">
        <div class="pc-avatar-wrap">
          <img :src="other.avatar_url" :alt="other.cn" class="pc-avatar" />
        </div>
        <div class="pc-body">
          <h3 class="pc-name">{{ other.cn }}</h3>
          <p v-if="other.bio" class="pc-bio">"{{ other.bio }}"</p>

          <div v-if="other.identity_tags?.length" class="pc-tags">
            <span v-for="t in other.identity_tags" :key="t" class="pc-tag">{{ t }}</span>
          </div>

          <div v-if="other.interest_tags?.length" class="pc-interests">
            <h4 class="pc-sub">兴趣</h4>
            <div class="pc-tag-row">
              <span v-for="t in other.interest_tags" :key="t" class="pc-int-tag">{{ t }}</span>
            </div>
          </div>

          <div v-if="other.intent_want?.length" class="pc-section">
            <h4 class="pc-sub">想认识/一起做</h4>
            <div class="pc-tag-row">
              <span v-for="t in other.intent_want" :key="t" class="pc-int-tag pc-want">{{ t }}</span>
            </div>
          </div>

          <div v-if="other.intent_provide?.length" class="pc-section">
            <h4 class="pc-sub">能提供</h4>
            <div class="pc-tag-row">
              <span v-for="t in other.intent_provide" :key="t" class="pc-int-tag pc-provide">{{ t }}</span>
            </div>
          </div>
        </div>
      </article>

      <!-- Dimension bars -->
      <section v-if="shareLevel >= 1" class="dim-card">
        <h3 class="section-title">各维度</h3>
        <div class="dim-row">
          <span class="dim-label">兴趣重合</span>
          <div class="dim-track"><div class="dim-fill dim-interest" :style="{ width: `${(score.interest / 40) * 100}%` }"></div></div>
          <span class="dim-num">{{ score.interest }}/40</span>
        </div>
        <div class="dim-row">
          <span class="dim-label">意图互补</span>
          <div class="dim-track"><div class="dim-fill dim-intent" :style="{ width: `${(score.intent / 30) * 100}%` }"></div></div>
          <span class="dim-num">{{ score.intent }}/30</span>
        </div>
        <div class="dim-row">
          <span class="dim-label">身份相同</span>
          <div class="dim-track"><div class="dim-fill dim-identity" :style="{ width: `${(score.identity / 15) * 100}%` }"></div></div>
          <span class="dim-num">{{ score.identity }}/15</span>
        </div>
        <div class="dim-row">
          <span class="dim-label">地区接近</span>
          <div class="dim-track"><div class="dim-fill dim-area" :style="{ width: `${(score.area / 15) * 100}%` }"></div></div>
          <span class="dim-num">{{ score.area }}/15</span>
        </div>
      </section>

      <!-- Action area -->
      <div class="action-area">
        <!-- 已发过请求（任意方向） -->
        <div v-if="existingRequest && !sent" class="action-already">
          <div class="action-already-icon">✓</div>
          <p v-if="existingRequest.requester_id === store.currentUserId">
            已发请求给 <strong>{{ other.cn }}</strong>，状态：{{ existingRequest.status === 'pending' ? '等待回应' : existingRequest.status === 'accepted' ? '已加好友' : '已拒绝' }}
          </p>
          <p v-else>
            <strong>{{ other.cn }}</strong>已向你发起请求
          </p>
          <button class="cta-secondary" @click="router.push('/messages')">
            去消息页 →
          </button>
        </div>

        <!-- 未发过请求 -->
        <div v-else-if="!sent && !showForm" class="action-cta">
          <button class="cta-primary" @click="showForm = true">
             想认识 TA
          </button>
        </div>

        <!-- 表单 -->
        <div v-if="showForm && !sent" class="action-form">
          <textarea
            v-model="message"
            class="form-input"
            placeholder="一起来玩吧！"
            maxlength="200"
            rows="3"
          ></textarea>
          <div class="form-actions">
            <button class="btn-ghost" @click="showForm = false">取消</button>
            <button class="btn-primary" :disabled="sending" @click="sendRequest">
              {{ sending ? '发送中…' : '发送' }}
            </button>
          </div>
        </div>

        <!-- 已发送 -->
        <div v-if="sent" class="action-success">
          <h3>已发送</h3>
          <p>{{ other.cn }} 同意后，你们可以互发消息和联系方式。</p>
          <button class="cta-secondary" @click="router.push('/messages')">
            去消息页查看
          </button>
        </div>
      </div>

      <button class="cta-back" @click="router.push('/home/matches')">
        返回匹配列表
      </button>
    </div>
  </div>

  <div v-else class="loading-page">
    <p>找不到该同好</p>
    <button class="cta-back" @click="router.push('/home/matches')" style="max-width: 200px; margin-top: 16px;">
      返回
    </button>
  </div>
</template>

<style scoped>
.md-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 480px;
  margin: 0 auto 14px;
}

.back-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
}

.md-shell {
  max-width: 480px;
  margin: 0 auto;
}

.score-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #fff5dc 0%, #fafaf8 100%);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 14px;
  border: 1px solid #f0ede5;
}

.score-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #2e7d32;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 意图互补卡片 */
.intent-match-card {
  background: linear-gradient(135deg, #fff8e1 0%, #f3e5f5 100%);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 14px;
  border: 1px solid #e8e6e1;
}

.intent-match-card .section-title {
  font-size: 15px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 14px;
}

.intent-match-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 4px;
}

.im-label {
  font-size: 12px;
  font-weight: 600;
  color: #8b7355;
  flex-shrink: 0;
  width: 56px;
  padding-top: 5px;
}

.im-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.im-chip {
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 14px;
  font-weight: 500;
}

.im-chip-them {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
}

.im-chip-me {
  background: #fff5dc;
  color: #5c4d2e;
  border: 1px solid #e0dcd4;
}

.im-arrow-row {
  margin-left: 66px;
  margin-bottom: 12px;
}

.im-arrow-text {
  font-size: 11px;
  color: #2e7d32;
  font-weight: 600;
}

.score-big {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}

.score-tag {
  font-size: 9px;
  margin-top: 2px;
  letter-spacing: 0.04em;
}

.score-info {
  flex: 1;
  min-width: 0;
}

.other-name {
  font-size: 22px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 4px;
  letter-spacing: -0.02em;
}

.other-meta {
  font-size: 13px;
  color: #5c5953;
}

.reasons-card,
.dim-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #f0ede5;
  margin-bottom: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: #5c5953;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
}

.reason-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reason-item {
  font-size: 13px;
  color: #2b2a26;
  padding: 8px 12px;
  background: #fafaf8;
  border-radius: 8px;
  border-left: 3px solid #2e7d32;
}

/* Profile card */
.profile-card {
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #f0ede5;
  margin-bottom: 12px;
}

.pc-avatar-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #fff5dc 0%, #fafaf8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pc-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.pc-body {
  padding: 14px 18px 18px;
}

.pc-name {
  font-size: 18px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 4px;
}

.pc-bio {
  font-size: 13px;
  color: #5c5953;
  font-style: italic;
  margin-bottom: 10px;
  line-height: 1.5;
}

.pc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 12px;
}

.pc-tag {
  font-size: 11px;
  padding: 3px 10px;
  background: #fff5dc;
  color: #5c4d2e;
  border-radius: 10px;
}

.pc-interests,
.pc-section {
  margin-bottom: 10px;
}

.pc-sub {
  font-size: 11px;
  font-weight: 600;
  color: #a8a39a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
}

.pc-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pc-int-tag {
  font-size: 12px;
  padding: 3px 9px;
  background: #fafaf8;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  color: #2b2a26;
}

.pc-want {
  background: #e3f2fd;
  border-color: #bbdefb;
  color: #1565c0;
}

.pc-provide {
  background: #f3e5f5;
  border-color: #e1bee7;
  color: #6a1b9a;
}

/* Dim bars */
.dim-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.dim-row:last-child {
  margin-bottom: 0;
}

.dim-label {
  font-size: 12px;
  color: #5c5953;
  width: 64px;
  flex-shrink: 0;
}

.dim-track {
  flex: 1;
  height: 6px;
  background: #fafaf8;
  border-radius: 3px;
  overflow: hidden;
}

.dim-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(.34,1.56,.64,1);
}

.dim-interest { background: #ec4899; }
.dim-intent { background: #f59e0b; }
.dim-identity { background: #14b8a6; }
.dim-area { background: #6366f1; }

.dim-num {
  font-size: 11px;
  color: #a8a39a;
  width: 40px;
  text-align: right;
  flex-shrink: 0;
}

.cta-back {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-top: 8px;
}

/* ===== Action area ===== */
.action-area {
  margin-bottom: 12px;
}

.cta-primary {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: #2e7d32;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: transform .12s ease;
}
.cta-primary:hover { transform: translateY(-1px); }

.action-form {
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #f0ede5;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  background: #fafaf8;
  color: #2b2a26;
}
.form-input:focus {
  outline: none;
  border-color: #2e7d32;
  background: #ffffff;
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  justify-content: flex-end;
}
.btn-ghost {
  padding: 8px 14px;
  background: transparent;
  color: #5c5953;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary {
  padding: 8px 18px;
  background: #2e7d32;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-success {
  text-align: center;
  background: #ffffff;
  border-radius: 14px;
  padding: 24px 16px;
  border: 1px solid #f0ede5;
}
.success-icon {
  font-size: 36px;
  margin-bottom: 8px;
}
.action-success h3 {
  font-size: 17px;
  font-weight: 700;
  color: #2e7d32;
  margin-bottom: 4px;
}
.action-success p {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 14px;
}

.action-already {
  text-align: center;
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #f0ede5;
}
.action-already-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e8f5e9;
  color: #2e7d32;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
  font-size: 18px;
  font-weight: 700;
}
.action-already p {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 10px;
}

.cta-secondary {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  background: #fff5dc;
  color: #5c4d2e;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #f0e6b8;
  cursor: pointer;
}

.loading-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafaf8;
  padding: 20px;
}
/* P0-C C1: 4 层可见度样式 */
.md-access-bar {
  margin: 12px 16px 8px;
  padding: 12px 14px;
  background: rgba(255, 248, 235, 0.7);
  border-radius: 12px;
  border: 1px solid #e8dcc4;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.md-access-vid {
  font-size: 12px;
  font-family: monospace;
  color: #8c8780;
  letter-spacing: 0.5px;
}
.md-access-level {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
}
.md-access-actions button {
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  cursor: pointer;
}
.btn-share-card { background: #d4a574; color: #fff; }
.btn-request-contact { background: #8b5a3c; color: #fff; }
.md-access-granted { font-size: 12px; color: #6b8e23; font-weight: 600; }

.md-fuzzy-tags {
  margin: 8px 16px;
  padding: 12px 14px;
  background: rgba(248, 245, 235, 0.5);
  border-radius: 12px;
  border: 1px dashed #d4a574;
}
.md-fuzzy-title { font-size: 11px; color: #8c8780; margin-bottom: 6px; }
.md-fuzzy-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.md-fuzzy-chip {
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #e8dcc4;
  border-radius: 12px;
  font-size: 11px;
  color: #8b7355;
}
.md-fuzzy-hint { font-size: 10px; color: #b5b0a5; text-align: right; }

/* L0 解锁提示 */
.md-locked-hint {
  background: #ffffff;
  border: 1px solid #f0ede5;
  border-radius: 14px;
  padding: 20px 16px;
  text-align: center;
  margin-bottom: 12px;
}
.md-locked-title {
  font-size: 15px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 6px;
}
.md-locked-sub {
  font-size: 12px;
  color: #8c8780;
  line-height: 1.5;
}
.other-meta-locked {
  font-size: 12px;
  color: #a8a39a;
}
</style>