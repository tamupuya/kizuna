<script setup lang="ts">
/**
 * ShareCard.vue — 分享导出专用竖版卡
 *
 * 与 ProfileView 的 cs-card 视觉一致（MUJI 竖版），但：
 * - 固定宽度 375px（导出确定尺寸，不受容器影响）
 * - 不渲染任何交互按钮（编辑/关闭）
 * - 不含联系方式（分享出去的卡必须公开态）
 * - 底部带品牌署名
 *
 * 用途：由 ProfileView 在离屏容器中渲染，再通过 html-to-image 导出 PNG。
 */
import { computed } from 'vue'
import { normalizeZodiac, extractMbti } from '../lib/zodiac'
import { extractMbtiRobust } from '../lib/mbti'

const props = defineProps<{ user: any }>()

const u = computed(() => props.user || {})

const hasAvatar = computed(() => {
  const url = u.value?.avatar_url
  return !!url && !String(url).includes('placehold.co')
})

const cn = computed(() => u.value?.cn || '')
const code = computed(() => u.value?.code || '------')

const mbti = computed(() =>
  u.value?.mbti || extractMbtiRobust(u.value?.intent_want) || extractMbti(u.value?.intent_want) || ''
)
const zodiacZh = computed(() => normalizeZodiac(u.value?.zodiac) || '')
const genderLabel = computed(() =>
  u.value?.gender === 'male' ? '男' : u.value?.gender === 'female' ? '女' : '保密'
)
const area = computed(() => u.value?.activity_area || '')

const identityTags = computed<string[]>(() => u.value?.identity_tags || [])
const bio = computed(() => u.value?.bio || '')

const interestCats = computed(() =>
  (u.value?.interest_categories || []).filter(
    (c: any) => c.state === 'C' && c.works && c.works.length > 0
  )
)
const ngTags = computed<string[]>(() => u.value?.ng_tags || [])
</script>

<template>
  <div class="sh-card">
    <!-- 头像 -->
    <div class="sh-header">
      <img v-if="hasAvatar" :src="u.avatar_url" :alt="cn" class="sh-avatar" crossorigin="anonymous" />
      <div v-else class="sh-avatar sh-avatar-ph">
        <img src="/default-avatar.svg" alt="默认头像" class="sh-avatar-img" />
      </div>
      <div class="sh-name">{{ cn }}</div>
      <div class="sh-code">#{{ code }}</div>
    </div>

    <!-- meta chips -->
    <div class="sh-meta">
      <span v-if="mbti" class="sh-chip">{{ mbti }}</span>
      <span v-if="zodiacZh" class="sh-chip">{{ zodiacZh }}</span>
      <span class="sh-chip">{{ genderLabel }}</span>
      <span v-if="area" class="sh-chip">{{ area }}</span>
    </div>

    <!-- 身份 -->
    <div v-if="identityTags.length" class="sh-tags">
      <span v-for="t in identityTags" :key="t" class="sh-tag">{{ t }}</span>
    </div>

    <!-- 签名 -->
    <div v-if="bio" class="sh-bio">
      <div class="sh-bio-label">签名</div>
      <div class="sh-bio-text">{{ bio }}</div>
    </div>

    <!-- 兴趣图鉴 -->
    <div v-if="interestCats.length" class="sh-interest">
      <div class="sh-interest-title">兴趣图鉴</div>
      <div class="sh-interest-list">
        <div v-for="cat in interestCats" :key="cat.name" class="sh-interest-cat">
          <span class="sh-cat-name">{{ cat.name }}</span>
          <span class="sh-cat-works">{{ (cat.works || []).join(' / ') }}</span>
        </div>
      </div>
    </div>

    <!-- 避雷 -->
    <div v-if="ngTags.length" class="sh-ng">
      <div class="sh-ng-title">避雷</div>
      <div class="sh-ng-list">
        <span v-for="ng in ngTags" :key="ng" class="sh-ng-chip">{{ ng }}</span>
      </div>
    </div>

    <!-- 品牌署名 -->
    <div class="sh-brand">
      <span class="sh-brand-mark">绊</span>
      <span class="sh-brand-text">KIZUNA · 泛二次元同好连接</span>
    </div>
  </div>
</template>

<style scoped>
.sh-card {
  width: 375px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #fffcf5 0%, #f7f5f0 100%);
  border-radius: 20px;
  border: 1px solid #e8e6e1;
  padding: 32px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans JP', 'Microsoft YaHei', sans-serif;
}

.sh-header {
  text-align: center;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebe9e4;
}

.sh-avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  object-fit: cover;
  background: #ede8df;
  border: 3px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  margin: 0 auto 12px;
  display: block;
}

.sh-avatar-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.sh-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sh-name {
  font-size: 28px;
  font-weight: 800;
  color: #2b2a26;
  line-height: 1.2;
  margin-bottom: 6px;
  word-break: break-word;
}

.sh-code {
  font-size: 14px;
  font-weight: 600;
  color: #8b7355;
  letter-spacing: 0.08em;
}

.sh-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.sh-chip {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(255, 245, 220, 0.6);
  color: #5c4d2e;
  border: 1px solid rgba(184, 173, 149, 0.25);
}

.sh-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

.sh-tag {
  font-size: 11px;
  padding: 3px 10px;
  background: rgba(255, 245, 220, 0.7);
  color: #5c4d2e;
  border-radius: 12px;
  border: 1px solid rgba(184, 173, 149, 0.3);
}

.sh-bio {
  background: rgba(255, 245, 220, 0.5);
  border-radius: 12px;
  padding: 10px 14px;
  border-left: 3px solid #b8ad95;
}

.sh-bio-label {
  font-size: 11px;
  font-weight: 700;
  color: #8b7355;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.sh-bio-text {
  font-size: 13px;
  color: #4a463f;
  line-height: 1.55;
  word-break: break-word;
}

.sh-interest-title,
.sh-ng-title {
  font-size: 11px;
  font-weight: 700;
  color: #8b7355;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.sh-interest-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sh-interest-cat {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
}

.sh-cat-name {
  color: #2b2a26;
  font-weight: 600;
  flex-shrink: 0;
}

.sh-cat-works {
  color: #7a756c;
  word-break: break-word;
}

.sh-ng-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.sh-ng-chip {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(196, 69, 69, 0.08);
  color: #a83535;
  border: 1px solid rgba(196, 69, 69, 0.18);
}

.sh-brand {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid #ebe9e4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sh-brand-mark {
  font-size: 15px;
  font-weight: 800;
  color: #2b2a26;
}

.sh-brand-text {
  font-size: 11px;
  color: #a8a39a;
  letter-spacing: 0.04em;
}
</style>
