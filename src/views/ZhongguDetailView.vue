<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { useAlertStore } from '../stores/alert'
import {
  RETURN_POLICY_OPTIONS,
  RETURN_SHIPPING_OPTIONS,
  STATUS_META,
  type ZhongguListing,
} from '../lib/mockData'
import { getMbtiName } from '../lib/mbti'
import { normalizeZodiac } from '../lib/zodiac'

const router = useRouter()
const route = useRoute()
const store = useKizunaStore()
const alertStore = useAlertStore()

const listing = ref<ZhongguListing | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)
const activeImage = ref(0)
const showRequestSheet = ref(false)
const requestMsg = ref('')
const sending = ref(false)

const listingId = computed(() => String(route.params.listingId || ''))

// 图片列表（form 保存到 images 字段，类型定义里没有，做兼容读取）
const images = computed<string[]>(() => {
  const raw = (listing.value as any)?.images
  if (Array.isArray(raw) && raw.length > 0) return raw
  return []
})

const isOwner = computed(
  () => !!listing.value && listing.value.owner_id === store.currentUserId,
)

// 是否已拍下（当前用户是买家）
const isBuyer = computed(
  () =>
    !!listing.value &&
    !!store.currentUserId &&
    listing.value.reserved_by === store.currentUserId,
)

const statusMeta = computed(() =>
  listing.value ? STATUS_META[listing.value.status] : null,
)

const typeLabel = computed(() => {
  const t = listing.value?.type
  if (t === 'sell') return '出'
  if (t === 'want') return '求'
  if (t === 'exchange') return '换'
  return ''
})

const priceText = computed(() => {
  const p = listing.value?.price
  if (p === null || p === undefined) return '面议'
  if (p === 0) return '免费'
  return `¥${p}`
})

const returnPolicy = computed(() =>
  RETURN_POLICY_OPTIONS.find((o) => o.value === listing.value?.return_policy),
)

const returnShipping = computed(() =>
  RETURN_SHIPPING_OPTIONS.find((o) => o.value === listing.value?.return_shipping),
)

const tradeModeText = computed(() => {
  const m = listing.value?.trade_mode
  if (m === 'meetup') return '线下自提'
  return '线上邮寄'
})

// 卖家信息
const seller = computed(() =>
  listing.value ? store.getUserByIdLocal(listing.value.owner_id) : undefined,
)

const sellerName = computed(() => seller.value?.cn || '同好')

const sellerMeta = computed(() => {
  const s = seller.value
  if (!s) return ''
  const parts: string[] = []
  if (s.mbti) parts.push(getMbtiName(s.mbti))
  const z = normalizeZodiac(s.zodiac)
  if (z) parts.push(z)
  if (s.activity_area) parts.push(s.activity_area)
  return parts.join(' · ')
})

const following = computed(() =>
  seller.value ? store.isFollowing(seller.value.id) : false,
)

// 联系方式可见性：仅本人或已拍下的买家可见
const canSeeContact = computed(() => isOwner.value || isBuyer.value)

// 时间格式
function timeAgo(input?: string | null) {
  if (!input) return ''
  const t = new Date(input).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(t).toLocaleDateString('zh-CN')
}

async function load() {
  loading.value = true
  errorMsg.value = null
  try {
    await store.fetchListing(listingId.value)
    const found =
      store.listings.find((l) => l.id === listingId.value) ||
      (store as any).activeListings?.find?.((l: ZhongguListing) => l.id === listingId.value)
    listing.value = (found as ZhongguListing) || null
    if (!listing.value) errorMsg.value = '商品不存在或已下架'
  } catch (e: any) {
    errorMsg.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/zhonggu')
}

function selectImage(i: number) {
  activeImage.value = i
}

// 关注卖家
async function onToggleFollow() {
  if (!seller.value) return
  if (!store.currentUserId) {
    router.push('/login')
    return
  }
  await store.toggleFollow(seller.value.id)
}

// 发起「我想要」
function openRequestSheet() {
  if (!store.currentUserId) {
    router.push('/login')
    return
  }
  if (isOwner.value) return
  requestMsg.value = `想收「${listing.value?.title || ''}」，还在吗？`
  showRequestSheet.value = true
}

async function sendRequest() {
  if (!listing.value || !store.currentUserId || sending.value) return
  const text = requestMsg.value.trim()
  if (!text) return
  sending.value = true
  try {
    const r = await store.createRequest(
      listing.value.owner_id,
      text,
      listing.value.id,
    )
    showRequestSheet.value = false
    if (r) {
      alertStore.success('已发送', '对方同意后会出现在「对话」里，可先去「想认识」查看')
      router.push('/messages?tab=outgoing')
    } else {
      alertStore.error('发送失败', store.error || '请稍后重试')
    }
  } finally {
    sending.value = false
  }
}

// 卖家操作：下架 / 重新上架 / 编辑
async function onArchive() {
  if (!listing.value) return
  await store.archiveListing(listing.value.id)
  await load()
}
async function onRestore() {
  if (!listing.value) return
  await store.restoreListing(listing.value.id)
  await load()
}
function onEdit() {
  // 2026-10-03：我的挂出已移到「关注」tab
  router.push('/zhonggu?tab=follow')
}

// 申诉入口
function goDispute() {
  if (!listing.value) return
  router.push(`/zhonggu/${listing.value.id}/dispute`)
}

onMounted(load)
</script>

<template>
  <div class="zd-page">
    <header class="zd-header">
      <button class="zd-back" @click="goBack" aria-label="返回">←</button>
      <h1 class="zd-title">商品详情</h1>
      <span v-if="statusMeta" class="zd-status" :class="`zd-status-${listing?.status}`">
        {{ statusMeta.label }}
      </span>
    </header>

    <!-- 加载 / 错误 -->
    <main v-if="loading" class="zd-center">
      <p class="zd-center-text">加载中…</p>
    </main>

    <main v-else-if="!listing" class="zd-center">
      <div class="zd-empty">
        <div class="zd-empty-icon"></div>
        <p class="zd-empty-text">{{ errorMsg || '商品不存在' }}</p>
        <button class="zd-btn-ghost" @click="goBack">返回中谷店</button>
      </div>
    </main>

    <template v-else>
      <main class="zd-body">
        <!-- 图片区 -->
        <section class="zd-gallery">
          <div class="zd-gallery-main">
            <img
              v-if="images.length > 0"
              :src="images[activeImage]"
              :alt="listing.title"
              class="zd-gallery-img"
            />
            <div v-else class="zd-gallery-ph">暂无图片</div>
            <span v-if="images.length > 1" class="zd-gallery-counter">
              {{ activeImage + 1 }} / {{ images.length }}
            </span>
          </div>
          <div v-if="images.length > 1" class="zd-thumbs">
            <button
              v-for="(img, i) in images"
              :key="i"
              class="zd-thumb"
              :class="{ 'zd-thumb-active': i === activeImage }"
              @click="selectImage(i)"
            >
              <img :src="img" :alt="`图 ${i + 1}`" />
            </button>
          </div>
        </section>

        <!-- 标题 + 价格 -->
        <section class="zd-card zd-head">
          <div class="zd-head-row">
            <span class="zd-type-badge">{{ typeLabel }}</span>
            <span class="zd-price">{{ priceText }}</span>
            <span v-if="listing.free_shipping" class="zd-free-ship">包邮</span>
          </div>
          <h2 class="zd-title-text">{{ listing.title }}</h2>
          <div class="zd-meta-row">
            <span v-if="listing.condition" class="zd-condition">{{ listing.condition }}</span>
            <span class="zd-meta-text">{{ timeAgo((listing as any).created_at) }}</span>
          </div>
        </section>

        <!-- 标签 -->
        <section v-if="listing.ip_tag || listing.character || (listing.tags && listing.tags.length)" class="zd-card">
          <h3 class="zd-section-title">作品信息</h3>
          <div class="zd-chip-row">
            <span v-if="listing.ip_tag" class="zd-chip zd-chip-main">{{ listing.ip_tag }}</span>
            <span v-if="listing.character" class="zd-chip">{{ listing.character }}</span>
            <span v-for="t in listing.tags || []" :key="t" class="zd-chip">{{ t }}</span>
          </div>
          <div v-if="listing.attributes && Object.keys(listing.attributes).length" class="zd-attr-list">
            <div v-for="(v, k) in listing.attributes" :key="k" class="zd-attr">
              <span class="zd-attr-k">{{ k }}</span>
              <span class="zd-attr-v">{{ v }}</span>
            </div>
          </div>
        </section>

        <!-- 描述 -->
        <section v-if="listing.description" class="zd-card">
          <h3 class="zd-section-title">详细描述</h3>
          <p class="zd-desc">{{ listing.description }}</p>
        </section>

        <!-- 交易方式 -->
        <section class="zd-card">
          <h3 class="zd-section-title">交易方式</h3>
          <div class="zd-line">
            <span class="zd-line-k">方式</span>
            <span class="zd-line-v">{{ tradeModeText }}</span>
          </div>
          <template v-if="listing.trade_mode === 'meetup'">
            <div class="zd-line">
              <span class="zd-line-k">自提地点</span>
              <span class="zd-line-v">{{ listing.meetup_place || '未填写' }}</span>
            </div>
          </template>
          <template v-else>
            <div class="zd-line">
              <span class="zd-line-k">收件地址</span>
              <span class="zd-line-v">{{ canSeeContact ? (listing.address || '未填写') : '拍下后可见' }}</span>
            </div>
            <div v-if="listing.address_note" class="zd-line">
              <span class="zd-line-k">地址备注</span>
              <span class="zd-line-v">{{ listing.address_note }}</span>
            </div>
          </template>
        </section>

        <!-- 退换政策 -->
        <section class="zd-card">
          <h3 class="zd-section-title">退换政策</h3>
          <div class="zd-line">
            <span class="zd-line-k">政策</span>
            <span class="zd-line-v">{{ returnPolicy?.label || '未填写' }}</span>
          </div>
          <p v-if="returnPolicy?.desc" class="zd-line-hint">{{ returnPolicy.desc }}</p>
          <div class="zd-line">
            <span class="zd-line-k">退货运费</span>
            <span class="zd-line-v">{{ returnShipping?.label || '未填写' }}</span>
          </div>
          <p v-if="listing.return_note" class="zd-line-hint">补充：{{ listing.return_note }}</p>
        </section>

        <!-- 联系方式 -->
        <section class="zd-card">
          <h3 class="zd-section-title">联系方式</h3>
          <template v-if="canSeeContact">
            <div v-if="listing.seller_wechat" class="zd-line">
              <span class="zd-line-k">微信</span>
              <span class="zd-line-v">{{ listing.seller_wechat }}</span>
            </div>
            <div v-if="listing.seller_qq" class="zd-line">
              <span class="zd-line-k">QQ</span>
              <span class="zd-line-v">{{ listing.seller_qq }}</span>
            </div>
            <p v-if="!listing.seller_wechat && !listing.seller_qq" class="zd-line-hint">卖家未填写</p>
          </template>
          <p v-else class="zd-line-hint zd-locked">
            拍下后才会看到卖家的联系方式
          </p>
        </section>

        <!-- 卖家 -->
        <section class="zd-card zd-seller">
          <div class="zd-seller-head">
            <div class="zd-seller-avatar">
              <img
                v-if="seller?.avatar_url && !String(seller.avatar_url).includes('placehold.co')"
                :src="seller.avatar_url"
                :alt="sellerName"
              />
              <img v-else src="/default-avatar.svg" :alt="sellerName" />
            </div>
            <div class="zd-seller-info">
              <p class="zd-seller-name">{{ sellerName }}</p>
              <p v-if="seller?.code" class="zd-seller-code">{{ seller.code }}</p>
              <p v-if="sellerMeta" class="zd-seller-meta">{{ sellerMeta }}</p>
            </div>
            <button
              v-if="!isOwner"
              class="zd-follow-btn"
              :class="{ 'zd-following': following }"
              @click="onToggleFollow"
            >
              {{ following ? '已关注' : '关注' }}
            </button>
          </div>
        </section>

        <!-- 卖家操作区 -->
        <section v-if="isOwner" class="zd-card">
          <h3 class="zd-section-title">管理</h3>
          <div class="zd-owner-actions">
            <button class="zd-btn-ghost" @click="onEdit">编辑挂出</button>
            <button v-if="listing.status === 'active'" class="zd-btn-ghost" @click="onArchive">下架</button>
            <button v-if="listing.status === 'archived'" class="zd-btn-ghost" @click="onRestore">重新上架</button>
          </div>
        </section>

        <!-- 买家申诉入口 -->
        <section
          v-if="isBuyer && (listing.status === 'reserved' || listing.status === 'shipped' || listing.status === 'completed')"
          class="zd-card"
        >
          <h3 class="zd-section-title">交易中</h3>
          <p class="zd-line-hint">当前状态：{{ statusMeta?.label }}</p>
          <button class="zd-btn-ghost" @click="goDispute">发起申诉</button>
        </section>

        <p class="zd-foot-note">绊不碰资金 · 不担保交易 · 请自行核实后再转账</p>
      </main>

      <!-- 底部操作栏 -->
      <footer v-if="!isOwner" class="zd-bar">
        <button class="zd-bar-btn" @click="onToggleFollow">
          {{ following ? '已关注' : '关注卖家' }}
        </button>
        <button
          class="zd-bar-btn-primary"
          :disabled="listing.status !== 'active'"
          @click="openRequestSheet"
        >
          {{ listing.status === 'active' ? '我想要' : (statusMeta?.label || '不可申请') }}
        </button>
      </footer>

      <!-- 我想要弹窗 -->
      <Teleport to="body">
        <div v-if="showRequestSheet" class="zd-mask" @click.self="showRequestSheet = false">
          <div class="zd-sheet">
            <h3 class="zd-sheet-title">我想要</h3>
            <p class="zd-sheet-sub">给卖家发一条消息，对方同意后会建立连接</p>
            <textarea
              v-model="requestMsg"
              class="zd-sheet-input"
              rows="3"
              maxlength="200"
              placeholder="说点什么…"
            ></textarea>
            <div class="zd-sheet-actions">
              <button class="zd-btn-cancel" @click="showRequestSheet = false">取消</button>
              <button class="zd-btn-primary" :disabled="sending || !requestMsg.trim()" @click="sendRequest">
                {{ sending ? '发送中…' : '发送' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.zd-page {
  min-height: 100vh;
  background: var(--kizuna-bg);
  display: flex;
  flex-direction: column;
  font-family: var(--kizuna-font-family);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 头部 */
.zd-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 10;
}
.zd-back {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 22px;
  color: #3c3c43;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.zd-back:active {
  background: #f7f5f0;
}
.zd-title {
  font-size: 16px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0;
  flex: 1;
}
.zd-status {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f7f5f0;
  color: #5c5953;
}
.zd-status-active {
  background: #eef6ee;
  color: #3f7a3f;
}
.zd-status-reserved {
  background: #fdf4e0;
  color: #9a7b2e;
}
.zd-status-shipped {
  background: #eaf1fb;
  color: #3b5f9e;
}
.zd-status-disputed {
  background: #fdeee6;
  color: #b05a2b;
}

.zd-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}
.zd-center-text {
  font-size: 14px;
  color: #8c8780;
}
.zd-empty {
  text-align: center;
}
.zd-empty-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 14px;
  border: 1px dashed #ddd8cc;
  border-radius: 4px;
}
.zd-empty-text {
  font-size: 14px;
  color: #8c8780;
  margin: 0 0 16px;
}

/* 主体 */
.zd-body {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 图库 */
.zd-gallery {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}
.zd-gallery-main {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f7f5f0;
}
.zd-gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.zd-gallery-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #b5b0a6;
}
.zd-gallery-counter {
  position: absolute;
  right: 10px;
  bottom: 10px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
}
.zd-thumbs {
  display: flex;
  gap: 8px;
  padding: 10px;
  overflow-x: auto;
}
.zd-thumb {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
  background: #f7f5f0;
  cursor: pointer;
}
.zd-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.zd-thumb-active {
  border-color: #3c3c43;
}

/* 卡片 */
.zd-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  padding: 14px;
}
.zd-head-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.zd-type-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #3c3c43;
  color: #fff5dc;
}
.zd-price {
  font-size: 20px;
  font-weight: 700;
  color: #c44545;
}
.zd-free-ship {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f7f5f0;
  color: #5c5953;
}
.zd-title-text {
  font-size: 17px;
  font-weight: 600;
  color: #3c3c43;
  line-height: 1.5;
  margin: 0 0 8px;
}
.zd-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.zd-condition {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f4eede;
  color: #7a7364;
}
.zd-meta-text {
  font-size: 12px;
  color: #b5b0a6;
}

.zd-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0 0 10px;
}
.zd-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.zd-chip {
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 4px;
  background: #f7f5f0;
  color: #5c5953;
  border: 1px solid #eee;
}
.zd-chip-main {
  background: #f4eede;
  color: #7a7364;
}
.zd-attr-list {
  margin-top: 12px;
  border-top: 1px solid #f2efe8;
  padding-top: 8px;
}
.zd-attr {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 5px 0;
}
.zd-attr-k {
  color: #8c8780;
}
.zd-attr-v {
  color: #3c3c43;
}

.zd-desc {
  font-size: 14px;
  line-height: 1.7;
  color: #3c3c43;
  white-space: pre-wrap;
  margin: 0;
  word-break: break-word;
}

.zd-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  padding: 6px 0;
}
.zd-line-k {
  color: #8c8780;
  flex-shrink: 0;
}
.zd-line-v {
  color: #3c3c43;
  text-align: right;
  word-break: break-word;
}
.zd-line-hint {
  font-size: 12px;
  color: #b5b0a6;
  margin: 2px 0 6px;
  line-height: 1.6;
}
.zd-locked {
  margin: 0;
}

/* 卖家 */
.zd-seller-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.zd-seller-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: #f7f5f0;
  flex-shrink: 0;
}
.zd-seller-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.zd-seller-info {
  flex: 1;
  min-width: 0;
}
.zd-seller-name {
  font-size: 14px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0 0 2px;
}
.zd-seller-code {
  font-size: 11px;
  color: #b5b0a6;
  margin: 0 0 2px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.zd-seller-meta {
  font-size: 12px;
  color: #8c8780;
  margin: 0;
}
.zd-follow-btn,
.zd-btn-ghost {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #eee;
  background: #fff;
  color: #5c5953;
  cursor: pointer;
  flex-shrink: 0;
}
.zd-follow-btn:active,
.zd-btn-ghost:active {
  background: #f7f5f0;
}
.zd-following {
  color: #b5b0a6;
}

.zd-owner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 底部栏 */
.zd-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 10px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 10;
}
.zd-bar-btn {
  flex: 0 0 34%;
  height: 44px;
  border-radius: 4px;
  border: 1px solid #eee;
  background: #fff;
  color: #5c5953;
  font-size: 14px;
  cursor: pointer;
}
.zd-bar-btn-primary {
  flex: 1;
  height: 44px;
  border-radius: 4px;
  border: none;
  background: #3c3c43;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.zd-bar-btn-primary:disabled {
  background: #d8d3c8;
  color: #fff;
}

.zd-foot-note {
  text-align: center;
  font-size: 11px;
  color: #b5b0a6;
  margin: 4px 0 0;
}

/* 弹窗 */
.zd-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}
.zd-sheet {
  width: 100%;
  background: #fff;
  border-radius: 4px 4px 0 0;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
}
.zd-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #3c3c43;
  margin: 0 0 4px;
}
.zd-sheet-sub {
  font-size: 12px;
  color: #8c8780;
  margin: 0 0 12px;
}
.zd-sheet-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 10px;
  font-size: 14px;
  font-family: inherit;
  color: #3c3c43;
  resize: none;
  outline: none;
}
.zd-sheet-input:focus {
  border-color: #3c3c43;
}
.zd-sheet-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.zd-btn-cancel {
  flex: 1;
  height: 44px;
  border-radius: 4px;
  border: 1px solid #eee;
  background: #fff;
  color: #5c5953;
  font-size: 14px;
  cursor: pointer;
}
.zd-btn-primary {
  flex: 1;
  height: 44px;
  border-radius: 4px;
  border: none;
  background: #3c3c43;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.zd-btn-primary:disabled {
  background: #d8d3c8;
}
</style>
