<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { findMatches } from '../lib/matching'
import { computed, ref, onMounted } from 'vue'
import QrSettingSheet from '../components/QrSettingSheet.vue'
import ShareCard from '../components/ShareCard.vue'
import { shareCardImage, shareCardText } from '../lib/share'
import { useAlertStore } from '../stores/alert'
import OcCard from '../components/OcCard.vue'
import ExpoRequestSheet from '../components/ExpoRequestSheet.vue'
import { normalizeZodiac, extractMbti } from '../lib/zodiac'
import { getMbtiName, extractMbtiRobust } from '../lib/mbti'

const router = useRouter()
const store = useKizunaStore()

const profile = computed(() => store.currentUser as any)
const intentEmpty = computed(() => {
  const p = profile.value
  if (!p) return true
  return !p.intent_want_meet?.length && !p.intent_want_do?.length && !p.intent_provide?.length
})

const intentSummary = computed(() => {
  const p = profile.value
  if (!p) return ''
  const parts = []
  if (p.intent_want_meet?.length) parts.push('想认识:' + p.intent_want_meet.slice(0, 2).join('·'))
  if (p.intent_provide?.length) parts.push('能提供:' + p.intent_provide.slice(0, 2).join('·'))
  return parts.join(' | ')
})

const isFirstTime = computed(() => {
  if (!profile.value) return true
  return !profile.value.cn || profile.value.cn === '用户 1' || !profile.value.identity_tags?.length
})

const matchCount = computed(() => {
  if (!profile.value) return 0
  return findMatches(profile.value, store.users as any[], [], 99).length
})

const showAdmin = ref(false)
onMounted(() => {
  showAdmin.value = !!localStorage.getItem('kizuna_admin_token')
})

// 用户角色（来自 users.role，v0.9.14 merchant SQL 已执行）
const myRole = computed(() => (profile.value as any)?.role || 'user')
const isMerchant = computed(() => ['merchant', 'operator', 'admin'].includes(myRole.value))

// 「找不到漫展」申请弹窗
const showExpoRequest = ref(false)

const menuItems = computed(() => {
  const base = [
    { label: '编辑名片', desc: 'CN、性别、身份、兴趣', path: '/editor' },
    { label: '我的 OC', desc: '查看 / 编辑你的角色', path: '/editor/oc' },
    { label: '我的意图', desc: '想认识的人、能提供', path: '/intent' },
    { label: '中谷店', desc: '查看我的挂出', path: '/zhonggu' },
    { label: '收款码', desc: qrSetCount.value > 0 ? `已设置 ${qrSetCount.value}/2 · 微信/支付宝` : '拍下后查看需上传', action: 'qr' as const },
    { label: '设置', desc: '通用、隐私', path: '/settings' },
  ]
  // 商家/运营：显示「漫展管理台」入口；普通用户：显示「找不到漫展？」提交入口
  if (isMerchant.value) {
    base.push({
      label: '漫展管理台',
      desc: myRole.value === 'merchant' ? '创建/编辑自家漫展' : '审核商家提交的漫展',
      path: '/merchant',
    })
  } else {
    base.push({
      label: '找不到漫展？',
      desc: '提交申请，运营审核后添加',
      action: 'expo_request' as const,
    })
  }
  return base
})

function go(path: string) { router.push(path) }

// 2026-07-28：收款设置弹窗
const showCardSheet = ref(false)
const showOcSheet = ref(false)    // OC 竖形弹窗

// 2026-10-07：人设卡分享（图片 / 文本）
const alertStore = useAlertStore()
const shareCardRef = ref<HTMLElement | null>(null)
const sharingImg = ref(false)

async function shareImage() {
  if (!shareCardRef.value || sharingImg.value) return
  sharingImg.value = true
  try {
    const r = await shareCardImage(shareCardRef.value, profile.value?.cn || '')
    if (r === 'shared') alertStore.success('已分享')
    else if (r === 'downloaded') alertStore.success('已保存图片', '图片已保存到设备')
  } catch (e: any) {
    alertStore.error('分享失败', e?.message || '请稍后重试')
  } finally {
    sharingImg.value = false
  }
}

async function shareCopyText() {
  try {
    const r = await shareCardText(profile.value)
    if (r === 'shared') alertStore.success('已分享')
    else if (r === 'copied') alertStore.success('已复制卡片摘要', '可粘贴到任意聊天窗口')
  } catch (e: any) {
    alertStore.error('分享失败', e?.message || '请稍后重试')
  }
}

// v0.9.23.1：MBTI 健壮提取（兼容多种存法），zodiac 走中文映射
const profileMbti = computed(() =>
  (profile.value as any)?.mbti || extractMbtiRobust(profile.value?.intent_want) || extractMbti(profile.value?.intent_want)
)
const profileMbtiName = computed(() => getMbtiName(profileMbti.value))
const profileZodiacZh = computed(() => normalizeZodiac(profile.value?.zodiac))
const showQrSheet = ref(false)

// OC 卡数据
const oc = computed(() => (profile.value as any)?.oc_card)
const hasOc = computed(() => {
  const c = oc.value
  if (!c) return false
  return !!(
    c.ocName ||
    c.ocBio ||
    c.ocWorld ||
    (Array.isArray(c.ocTags) && c.ocTags.length) ||
    c.ocDescText
  )
})
const myQrState = computed(() => {
  const c = (profile.value as any)?.contact || {}
  return {
    wechat: c.wechat_qr || null,
    alipay: c.alipay_qr || null,
  }
})
const qrSetCount = computed(() => {
  return (myQrState.value.wechat ? 1 : 0) + (myQrState.value.alipay ? 1 : 0)
})

// v0.9.23.4：头像——未上传或仍是 placehold 首字母图时，fallback 小猫默认头像
const hasAvatar = computed(() => {
  const u = (profile.value as any)?.avatar_url
  return !!u && !u.includes('placehold.co')
})

// v0.9.23.4：人设卡 + OC 卡横向滑动 + 小圆点
const swipePanels = computed(() => {
  const panels: { key: string }[] = [{ key: 'persona' }]
  panels.push(hasOc.value ? { key: 'oc' } : { key: 'oc-create' })
  return panels
})
const activeSwipe = ref(0)
function onSwipeScroll(e: Event) {
  const el = e.target as HTMLElement
  const w = el.clientWidth || 1
  const idx = Math.round(el.scrollLeft / w)
  activeSwipe.value = Math.max(0, Math.min(idx, swipePanels.value.length - 1))
}
</script>

<template>
  <div class="profile-page">
    <div v-if="!profile" class="empty-shell">
      <div class="empty-card">
        <h1 class="empty-title">还没有你的卡</h1>
        <p class="empty-desc">创建后可解锁更多内容</p>
        <button @click="go('/editor')" class="empty-cta-primary">创建人设卡</button>
        <button @click="store.signOut(); go('/select')" class="empty-cta-skip">选择其他身份</button>
      </div>
    </div>

    <div v-else class="profile-shell">
      <!-- v0.9.23.4：人设卡 + OC 卡左右滑动（scroll-snap + 小圆点） -->
      <div class="cards-swiper">
        <div class="swipe-track" @scroll="onSwipeScroll">
          <!-- 人设卡矩形占位卡（小卡：无头像、无虚拟编号） -->
          <div class="swipe-panel">
            <div class="persona-rect-card" @click="showCardSheet = true">
              <div class="rect-card-bg"></div>
              <div class="rect-card-content">
                <div class="rect-card-header">
                  <div class="rect-card-id">
                    <div class="rect-card-name">{{ profile.cn || '' }}</div>
                    <div class="rect-card-code">#{{ profile.code || '------' }}</div>
                  </div>
                </div>
                <div class="rect-card-sub">
                  <span v-if="profileMbti" class="rect-chip">{{ profileMbti }}</span>
                  <span v-if="profileZodiacZh" class="rect-chip">{{ profileZodiacZh }}</span>
                  <span v-if="profile.activity_area" class="rect-chip">{{ profile.activity_area }}</span>
                </div>
                <div v-if="profile.identity_tags?.length" class="rect-card-tags">
                  <span v-for="t in profile.identity_tags" :key="t" class="rect-tag">{{ t }}</span>
                </div>
                <div v-if="profile.bio" class="rect-card-bio">{{ profile.bio }}</div>
              </div>
              <div v-if="intentSummary" class="rect-card-intent-summary">{{ intentSummary }}</div>
              <div class="rect-card-hint">点击查看卡片</div>
            </div>
          </div>

          <!-- OC 卡矩形占位卡 / 创建 banner -->
          <div class="swipe-panel">
            <div v-if="hasOc" class="oc-rect-card" @click="showOcSheet = true">
              <div class="oc-rect-bg" :style="oc.ocIllust ? { backgroundImage: `url(${oc.ocIllust})` } : {}"></div>
              <div class="oc-rect-content">
                <div class="oc-rect-label">OC</div>
                <div class="oc-rect-name">{{ oc.ocName }}</div>
                <div v-if="oc.ocBio" class="oc-rect-bio">{{ oc.ocBio }}</div>
                <div v-if="oc.ocTags?.length" class="oc-rect-tags">
                  <span v-for="t in oc.ocTags.slice(0, 4)" :key="t" class="oc-rect-tag">{{ t }}</span>
                </div>
              </div>
              <div class="oc-rect-hint">点击查看 OC 卡</div>
            </div>
            <div v-else class="oc-create-banner" @click="go('/editor/oc')">
              <div class="banner-content">
                <div class="banner-title">创建你的 OC</div>
                <div class="banner-desc">为你喜欢的角色立一张卡</div>
              </div>
              <span class="banner-arrow">›</span>
            </div>
          </div>
        </div>
        <!-- 小圆点：几张卡几个点 -->
        <div class="swipe-dots">
          <span
            v-for="(p, i) in swipePanels"
            :key="p.key"
            class="swipe-dot"
            :class="{ active: activeSwipe === i }"
          ></span>
        </div>
      </div>

      <!-- 如果没填，显示创建入口 -->
      <div v-if="isFirstTime" class="first-time-banner" @click="go('/editor')">
        <div class="banner-content">
          <div class="banner-title">完成你的人设卡</div>
          <div class="banner-desc">还请让我多了解一些，关于你的事</div>
        </div>
        <span class="banner-arrow">›</span>
      </div>

      <!-- v0.9.23：匹配入口已删除（p0-1） -->

      <!-- Stats Row (简洁数字) -->
      <div class="stats-row">
        <div class="stat" @click="go('/zhonggu')">
          <div class="stat-num">{{ store.myListings.length }}</div>
          <div class="stat-label">挂出</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat" @click="go('/zhonggu')">
          <div class="stat-num">{{ store.publicListings.length }}</div>
          <div class="stat-label">广场</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat" @click="go('/messages')">
          <div class="stat-num">0</div>
          <div class="stat-label">消息</div>
        </div>
      </div>

      <!-- 兴趣图鉴已隐藏（用户要求 v0.9.8） -->

      <!-- 意图区域 -->
      <section
        v-if="
          profile.intent_want_meet?.length ||
          profile.intent_want_do?.length ||
          profile.intent_provide?.length
        "
        class="profile-section"
      >
        <header class="section-header">
          <h2 class="section-title">意图</h2>
          <button class="section-edit" @click="go('/intent')">编辑 →</button>
        </header>
        <div class="intent-stack">
          <div v-if="profile.intent_want_meet?.length" class="intent-block">
            <div class="intent-block-label">
              <span>想认识的人</span>
            </div>
            <div class="intent-chip-row">
              <span v-for="t in profile.intent_want_meet" :key="t" class="intent-chip intent-chip-meet">{{ t }}</span>
            </div>
          </div>
          <div v-if="profile.intent_want_do?.length" class="intent-block">
            <div class="intent-block-label">
              <span>想一起做的事</span>
            </div>
            <div class="intent-chip-row">
              <span v-for="t in profile.intent_want_do" :key="t" class="intent-chip intent-chip-do">{{ t }}</span>
            </div>
          </div>
          <div v-if="profile.intent_provide?.length" class="intent-block">
            <div class="intent-block-label">
              <span>我能提供</span>
            </div>
            <div class="intent-chip-row">
              <span v-for="t in profile.intent_provide" :key="t" class="intent-chip intent-chip-provide">{{ t }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 菜单（极简） -->
      <nav class="profile-nav">
        <button
          v-for="m in menuItems"
          :key="m.label"
          class="nav-row"
          @click="m.action === 'qr' ? (showQrSheet = true) : m.action === 'expo_request' ? (showExpoRequest = true) : go(m.path!)"
        >
          <div class="nav-text">
            <div class="nav-label">{{ m.label }}</div>
            <div class="nav-desc">{{ m.desc }}</div>
          </div>
          <span class="nav-arrow">›</span>
        </button>
      </nav>

      <div class="profile-footer">
        <div class="footer-links">
          <button class="footer-link-btn" @click="go('/about')">关于</button>
          <span class="footer-link-dot">·</span>
          <button class="footer-link-btn" @click="go('/feedback')">反馈</button>
          <span class="footer-link-dot">·</span>
          <button class="footer-link-btn" @click="store.signOut(); go('/select')">退出登录</button>
        </div>
      </div>
      <div class="safe-bottom" />
    </div>

    <!-- 离屏分享卡（导出用；移出视口但保持渲染） -->
    <Teleport to="body">
      <div v-if="profile" class="share-offscreen" aria-hidden="true">
        <div ref="shareCardRef">
          <ShareCard :user="profile" />
        </div>
      </div>
    </Teleport>

    <!-- 人设卡竖形弹窗（步骤 2） -->
    <Teleport to="body">
      <Transition name="card-sheet">
        <div v-if="showCardSheet" class="card-sheet-overlay" @click.self="showCardSheet = false">
          <div class="card-sheet-vertical">
            <!-- 左上编辑 -->
            <button class="cs-edit-btn" @click="showCardSheet = false; go('/editor')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <!-- 右上关闭 -->
            <button class="cs-close-btn" @click="showCardSheet = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <!-- 竖形卡内容：头像（未设置时小猫默认头像） -->
            <div class="cs-card-body">
              <div class="cs-card-header">
                <img
                  v-if="hasAvatar"
                  :src="profile.avatar_url"
                  :alt="profile.cn"
                  class="cs-card-avatar"
                  @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <div v-else class="cs-card-avatar cs-card-avatar-placeholder">
                  <img src="/default-avatar.svg" alt="默认头像" class="cs-card-avatar-img" />
                </div>
                <div class="cs-card-id">
                  <div class="cs-card-name">{{ profile.cn || '' }}</div>
                  <div class="cs-card-code">#{{ profile.code || '------' }}</div>
                </div>
              </div>
              <div class="cs-card-meta">
                <span v-if="profileMbti" class="cs-chip">{{ profileMbti }}</span>
                <span v-if="profileZodiacZh" class="cs-chip">{{ profileZodiacZh }}</span>
                <span class="cs-chip">{{
                  profile.gender === 'male' ? '男' :
                  profile.gender === 'female' ? '女' : '保密'
                }}</span>
                <span v-if="profile.activity_area" class="cs-chip">{{ profile.activity_area }}</span>
              </div>
              <div v-if="profile.identity_tags?.length" class="cs-card-tags">
                <span v-for="t in profile.identity_tags" :key="t" class="cs-tag">{{ t }}</span>
              </div>
              <div v-if="profile.bio" class="cs-card-bio">
                <div class="cs-bio-label">签名</div>
                <div class="cs-bio-text">{{ profile.bio }}</div>
              </div>
              <div v-if="profile.interest_categories?.length" class="cs-card-interest">
                <div class="cs-interest-title">兴趣图鉴</div>
                <div class="cs-interest-list">
                  <div v-for="cat in (profile.interest_categories || []).filter(c => c.state === 'C' && c.works && c.works.length > 0)" :key="cat.name" class="cs-interest-cat">
                    <span class="cs-cat-name">{{ cat.name }}</span>
                    <span class="cs-cat-works">{{ (cat.works || []).join(' / ') }}</span>
                  </div>
                </div>
              </div>
              <div v-if="profile.ng_tags?.length" class="cs-card-ng">
                <div class="cs-ng-title">避雷</div>
                <div class="cs-ng-list">
                  <span v-for="ng in profile.ng_tags" :key="ng" class="cs-ng-chip">{{ ng }}</span>
                </div>
              </div>
            </div>

            <!-- 分享行 -->
            <div class="cs-share-row">
              <button class="cs-share-btn cs-share-primary" :disabled="sharingImg" @click="shareImage">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                {{ sharingImg ? '生成中…' : '分享图片' }}
              </button>
              <button class="cs-share-btn" @click="shareCopyText">复制文本</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- OC 竖卡弹窗 -->
    <Teleport to="body">
      <Transition name="card-sheet">
        <div v-if="showOcSheet" class="card-sheet-overlay" @click.self="showOcSheet = false">
          <div class="oc-pop-card">
            <button class="cs-close-btn" @click="showOcSheet = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <OcCard
              :oc-name="oc.ocName"
              :oc-bio="oc.ocBio"
              :oc-world="oc.ocWorld"
              :oc-illust="oc.ocIllust"
              :oc-tags="oc.ocTags || []"
              :oc-desc-text="oc.ocDescText"
              :aspect="oc.ocAspect === '1/1' ? '1/1' : '3/4'"
              editable
              closable
              @edit="showOcSheet = false; go('/editor/oc')"
              @close="showOcSheet = false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 2026-07-28：收款码设置弹窗 -->
    <QrSettingSheet v-if="showQrSheet" :initial="myQrState" @close="showQrSheet = false" />

    <!-- v0.9.14：用户「找不到漫展」提交申请 -->
    <ExpoRequestSheet v-if="showExpoRequest" @close="showExpoRequest = false" />
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px 0 calc(80px + env(safe-area-inset-bottom));
}

.profile-shell {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px;
}

/* ===== v0.9.23.4：卡片滑动容器 + 小圆点 ===== */
.cards-swiper {
  margin-bottom: 16px;
}
.swipe-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  gap: 12px;
  padding-bottom: 12px;
}
.swipe-track::-webkit-scrollbar {
  display: none;
}
.swipe-panel {
  flex: 0 0 calc(100% - 24px);
  scroll-snap-align: center;
}
.swipe-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding-top: 2px;
}
.swipe-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d8d4cc;
  transition: all 0.2s ease;
}
.swipe-dot.active {
  width: 8px;
  height: 8px;
  background: #2b2a26;
}

/* ===== 人设卡矩形占位卡 ===== */
.persona-rect-card {
  position: relative;
  width: 100%;
  height: 168px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #e8e6e1;
  background: #f7f5f0;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.persona-rect-card:active {
  transform: scale(0.98);
}

.rect-card-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #f7f5f0 0%, #ede8df 100%);
}

.rect-card-content {
  position: relative;
  padding: 18px 18px 14px;
  z-index: 1;
}

/* v0.9.23.4：小卡无头像，CN + 编号行 */
.rect-card-header {
  margin-bottom: 10px;
}

.rect-card-id {
  min-width: 0;
}

.rect-card-name {
  font-size: 20px;
  font-weight: 800;
  color: #2b2a26;
  letter-spacing: -0.02em;
  margin-bottom: 2px;
}

.rect-card-code {
  font-size: 12px;
  font-weight: 600;
  color: #8b7355;
  letter-spacing: 0.06em;
}

.rect-card-sub {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

/* v0.9.23.4：chip 统一中性色（无 MBTI/星座颜色） */
.rect-chip {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(255, 245, 220, 0.6);
  color: #5c4d2e;
  border: 1px solid rgba(184, 173, 149, 0.25);
}

.rect-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rect-tag {
  font-size: 11px;
  padding: 2px 10px;
  background: rgba(255, 245, 220, 0.6);
  color: #5c4d2e;
  border-radius: 12px;
  border: 1px solid rgba(184, 173, 149, 0.25);
}

.rect-card-bio {
  font-size: 13px;
  line-height: 1.5;
  color: #5c4d2e;
  background: rgba(255, 245, 220, 0.45);
  border-radius: 10px;
  padding: 8px 12px;
  margin-top: 4px;
  font-style: italic;
  word-break: break-word;
}

.rect-card-hint {
  position: relative;
  text-align: center;
  font-size: 12px;
  color: #b0b0b0;
  padding: 8px 0 4px;
  z-index: 1;
}

/* ===== 竖形弹窗（游戏王风格） ===== */
.card-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card-sheet-vertical {
  position: relative;
  width: 100%;
  max-width: 360px;
  max-height: 85vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #fffcf5 0%, #f7f5f0 100%);
  border-radius: 20px;
  border: 1px solid #e8e6e1;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 48px 24px 24px;
}

.cs-edit-btn {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e8e6e1;
  background: rgba(255, 255, 255, 0.9);
  color: #5c5953;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  transition: all 0.18s ease;
}

.cs-edit-btn:hover {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

.cs-close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e8e6e1;
  background: rgba(255, 255, 255, 0.9);
  color: #5c5953;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  transition: all 0.18s ease;
}

.cs-close-btn:hover {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

.cs-card-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cs-card-header {
  text-align: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebe9e4;
}

/* v0.9.10.1: 竖形弹窗头像 */
.cs-card-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  background: #ede8df;
  border: 3px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin: 0 auto 12px;
  display: block;
}

.cs-card-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: #8b7355;
  background: #ede8df;
}

.cs-card-id {
  text-align: center;
}

.cs-card-name {
  font-size: 28px;
  font-weight: 800;
  color: #2b2a26;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}

.cs-card-code {
  font-size: 14px;
  font-weight: 600;
  color: #8b7355;
  letter-spacing: 0.08em;
}

.cs-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

/* v0.9.23.4：chip 统一中性色 */
.cs-chip {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(255, 245, 220, 0.6);
  color: #5c4d2e;
  border: 1px solid rgba(184, 173, 149, 0.25);
}

.cs-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

.cs-tag {
  font-size: 11px;
  padding: 3px 10px;
  background: rgba(255, 245, 220, 0.7);
  color: #5c4d2e;
  border-radius: 12px;
  border: 1px solid rgba(184, 173, 149, 0.3);
}

.cs-card-bio {
  background: rgba(255, 245, 220, 0.5);
  border-radius: 12px;
  padding: 10px 14px;
  border-left: 3px solid #b8ad95;
}

.cs-bio-label {
  font-size: 11px;
  font-weight: 700;
  color: #8b7355;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.cs-bio-text {
  font-size: 14px;
  line-height: 1.5;
  color: #2b2a26;
  word-break: break-word;
  white-space: pre-wrap;
}

.cs-card-interest {
  border-top: 1px solid #ebe9e4;
  padding-top: 16px;
}

.cs-interest-title {
  font-size: 13px;
  font-weight: 700;
  color: #8b7355;
  margin-bottom: 10px;
}

.cs-interest-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cs-interest-cat {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.cs-cat-name {
  font-size: 12px;
  font-weight: 700;
  color: #2b2a26;
  flex-shrink: 0;
  min-width: 60px;
}

.cs-cat-works {
  font-size: 13px;
  color: #6b6b6b;
  line-height: 1.5;
}

.cs-card-ng {
  border-top: 1px solid #ebe9e4;
  padding-top: 16px;
}

.cs-ng-title {
  font-size: 13px;
  font-weight: 700;
  color: #e5345a;
  margin-bottom: 10px;
}

.cs-ng-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cs-ng-chip {
  font-size: 11px;
  padding: 3px 10px;
  background: rgba(229, 52, 90, 0.1);
  color: #c0392b;
  border-radius: 12px;
  border: 1px solid rgba(229, 52, 90, 0.2);
}

/* ===== 分享（2026-10-07） ===== */
.cs-share-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebe9e4;
}

.cs-share-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 42px;
  border-radius: 8px;
  border: 1px solid #e0dcd5;
  background: #fff;
  color: #5c5953;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.cs-share-btn:hover {
  border-color: #b8ad95;
  background: #faf8f4;
}

.cs-share-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.cs-share-primary {
  background: #2b2a26;
  border-color: #2b2a26;
  color: #fff5dc;
}

.cs-share-primary:hover {
  background: #3d3b35;
  border-color: #3d3b35;
}

/* 离屏分享卡：移出视口但保持布局（html-to-image 需可测尺寸） */
.share-offscreen {
  position: fixed;
  left: -10000px;
  top: 0;
  z-index: -1;
  pointer-events: none;
}

/* 弹窗动画 */
.card-sheet-enter-active,
.card-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.card-sheet-enter-from,
.card-sheet-leave-to {
  opacity: 0;
}

.card-sheet-enter-active .card-sheet-vertical {
  animation: cardSheetIn 0.3s ease;
}

@keyframes cardSheetIn {
  from { transform: scale(0.92) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

/* First-time banner */
.first-time-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: linear-gradient(135deg, #fff5dc 0%, #fafaf8 100%);
  border-radius: 14px;
  margin-bottom: 16px;
  border: 1px dashed #b8ad95;
  cursor: pointer;
  transition: all 0.18s ease;
}

.first-time-banner:hover {
  border-style: solid;
  background: linear-gradient(135deg, #fff5dc 0%, #ffffff 100%);
}

.banner-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.banner-content {
  flex: 1;
}

.banner-title {
  font-size: 15px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 2px;
}

.banner-desc {
  font-size: 12px;
  color: #5c5953;
}

.banner-arrow {
  font-size: 20px;
  color: #b8ad95;
}

/* Empty state (no currentUser) */
.empty-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafaf8;
  padding: 20px;
}

.empty-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 36px 28px;
  text-align: center;
  border: 1px solid #f0ede5;
  max-width: 320px;
  width: 100%;
}

.empty-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 19px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 20px;
  line-height: 1.5;
}

.empty-cta-primary {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-bottom: 8px;
  transition: background 0.18s ease;
}

.empty-cta-primary:hover {
  background: #3a3528;
}

.empty-cta-skip {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  background: transparent;
  color: #a8a39a;
  font-size: 13px;
  border: none;
  cursor: pointer;
  transition: color 0.18s ease;
}

.empty-cta-skip:hover {
  color: #5c5953;
}

/* Match card */
.match-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #f3e5f5 0%, #fff5dc 100%);
  border-radius: 14px;
  margin-bottom: 16px;
  border: 1px solid #f0ede5;
  cursor: pointer;
  transition: all 0.18s ease;
}

.match-card:hover {
  border-color: #b8ad95;
  transform: translateY(-1px);
}

.match-card-text {
  flex: 1;
  min-width: 0;
}

.match-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 2px;
}

.match-card-desc {
  font-size: 12px;
  color: #5c5953;
}

.match-card-arrow {
  font-size: 22px;
  color: #6a1b9a;
}

/* Stats row */
.stats-row {
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 14px;
  padding: 16px 0;
  margin-bottom: 16px;
  border: 1px solid #f0ede5;
}

.stat {
  flex: 1;
  text-align: center;
  cursor: pointer;
  transition: opacity 0.18s ease;
}

.stat:hover {
  opacity: 0.7;
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 11px;
  color: #a8a39a;
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: #f0ede5;
}

/* Sections */
.profile-section {
  background: #ffffff;
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 14px;
  border: 1px solid #f0ede5;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #2b2a26;
  letter-spacing: -0.01em;
}

.section-edit {
  background: none;
  border: none;
  font-size: 13px;
  color: #5c4d2e;
  cursor: pointer;
  font-weight: 500;
}

/* Interest mosaic (摄影优先交替瓷砖) */
.interest-mosaic {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.interest-tile {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #f0ede5;
  background: #fafaf8;
}

.tile-0 {
  background: linear-gradient(135deg, #fff5dc 0%, #fafaf8 100%);
}

.tile-2 {
  background: linear-gradient(135deg, #f4f0e8 0%, #fafaf8 100%);
}

.tile-cat-name {
  font-size: 12px;
  font-weight: 700;
  color: #5c4d2e;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tile-works {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tile-work {
  font-size: 13px;
  padding: 3px 10px;
  background: #ffffff;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  color: #2b2a26;
}

.tile-empty {
  font-size: 11px;
  color: #a8a39a;
  font-style: italic;
}

/* Intent stack */
.intent-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.intent-block-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 8px;
}

.intent-emoji {
  font-size: 15px;
}

.intent-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.intent-chip {
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 14px;
  border: 1px solid #e8e6e1;
  background: #ffffff;
  color: #5c5953;
  transition: all 0.18s ease;
}

.intent-chip-meet {
  background: #e3f2fd;
  border-color: #bbdefb;
  color: #1565c0;
}

.intent-chip-do {
  background: #f3e5f5;
  border-color: #e1bee7;
  color: #6a1b9a;
}

.intent-chip-provide {
  background: #fff5dc;
  border-color: #e0dcd4;
  color: #5c4d2e;
}

/* Profile nav (Apple style) */
.profile-nav {
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #f0ede5;
  margin-bottom: 16px;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 18px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  border-bottom: 1px solid #f5f3ee;
  transition: background 0.18s ease;
}

.nav-row:last-child {
  border-bottom: none;
}

.nav-row:hover {
  background: #fafaf8;
}

.nav-row:active {
  background: #f4f0e8;
}

.nav-text {
  flex: 1;
  min-width: 0;
}

.nav-label {
  font-size: 15px;
  font-weight: 500;
  color: #2b2a26;
  margin-bottom: 2px;
}

.nav-desc {
  font-size: 12px;
  color: #a8a39a;
}

.nav-arrow {
  font-size: 18px;
  color: #c0bbb0;
}

.profile-footer {
  text-align: center;
  padding: 28px 20px 20px;
  margin-top: 32px;
  border-top: 1px dashed var(--kizuna-border);
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.footer-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--kizuna-grad-cta);
  color: var(--kizuna-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}

.footer-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: 0.15em;
  line-height: 1;
  text-align: left;
}

.footer-version {
  font-size: 10px;
  color: var(--kizuna-text-faint);
  letter-spacing: 0.2em;
  margin-top: 4px;
  text-align: left;
}

.footer-tagline {
  font-size: 11px;
  color: var(--kizuna-text-soft);
  margin: 0 0 12px;
  letter-spacing: 0.05em;
}

.footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-bottom: 12px;
}

.footer-link-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--kizuna-text-soft);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.18s ease;
}

.footer-link-btn:hover {
  background: var(--kizuna-bg);
  color: var(--kizuna-text);
}

.footer-link-dot {
  font-size: 10px;
  color: var(--kizuna-text-faint);
}

.footer-copyright {
  font-size: 10px;
  color: var(--kizuna-text-faint);
  margin: 0;
  letter-spacing: 0.1em;
}

.safe-bottom {
  height: 24px;
}

/* ===== OC 矩形占位卡（v0.9.23.1：粉蓝渐变替代冷蓝；v0.9.23.4：固定高 168px 小卡） ===== */
.oc-rect-card {
  position: relative;
  width: 100%;
  height: 168px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid rgba(184, 168, 200, 0.55);
  background: linear-gradient(135deg, #fff0f6 0%, #fce8f0 30%, #e8f0fc 70%, #e3ecf8 100%);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.oc-rect-card:active {
  transform: scale(0.98);
}
.oc-rect-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0.5;
}
.oc-rect-content {
  position: relative;
  padding: 14px 16px 12px;
  z-index: 1;
  /* v0.9.23.1：粉蓝渐变（粉→蓝） */
  background: linear-gradient(135deg, rgba(255, 240, 246, 0.75) 0%, rgba(252, 232, 240, 0.65) 40%, rgba(232, 240, 252, 0.55) 100%);
}
.oc-rect-label {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #a05b8a;
  background: rgba(255, 220, 232, 0.6);
  border-radius: 4px;
  padding: 2px 8px;
  margin-bottom: 8px;
}
.oc-rect-name {
  font-size: 18px;
  font-weight: 800;
  color: #2b2a26;
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}
.oc-rect-bio {
  font-size: 12px;
  line-height: 1.5;
  color: #5c4d2e;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.oc-rect-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.oc-rect-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: rgba(255, 200, 220, 0.45);
  color: #8a4870;
  border-radius: 4px;
}
.oc-rect-hint {
  position: relative;
  text-align: right;
  font-size: 11px;
  color: #a05b8a;
  padding: 4px 14px 8px;
  z-index: 1;
}

/* OC 创建 banner（v0.9.23.4：固定高 168px 小卡） */
.oc-create-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 14px;
  background: linear-gradient(135deg, #e8f0f7 0%, #fafaf8 100%);
  border-radius: 14px;
  border: 1px dashed #6b8cae;
  cursor: pointer;
  transition: all 0.18s ease;
  height: 168px;
  box-sizing: border-box;
}
.oc-create-banner:hover {
  border-style: solid;
  background: linear-gradient(135deg, #e8f0f7 0%, #ffffff 100%);
}

/* OC 弹窗 */
.oc-pop-card {
  position: relative;
  width: 100%;
  max-width: 320px;
  z-index: 2;
}
</style>