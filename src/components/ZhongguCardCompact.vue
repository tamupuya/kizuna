<script setup lang="ts">
import { computed } from 'vue'
import type { ZhongguListing, User } from '../lib/mockData'

const props = defineProps<{
  listing: ZhongguListing
  owner?: User
}>()

const emit = defineEmits<{
  (e: 'click', listingId: string): void
}>()

function onCardClick() {
  emit('click', props.listing.id)
}

const images = computed(() => {
  return ((props.listing as any).images as string[] | undefined) || []
})

const typeMap: Record<string, { text: string; bg: string; color: string }> = {
  sell: { text: '出', bg: '#e3f2fd', color: '#1565c0' },
  want: { text: '求', bg: '#fff5dc', color: '#5c4d2e' },
  exchange: { text: '换', bg: '#f3e5f5', color: '#6a1b9a' },
}

const conditionColor: Record<string, string> = {
  '几乎全新': '#f59e0b',
  '全新': '#10b981',
  '良好': '#6b7280',
  '一般': '#9ca3af',
}

const cn = computed(() => props.owner?.cn || '匿名')
const avatarUrl = computed(() => props.owner?.avatar_url || '')

const hasFreeShipping = computed(() => props.listing.free_shipping === true)

const wantsCount = computed(() => props.listing.wants_count ?? 0)
</script>

<template>
  <div class="zcc kz-tap" @click="onCardClick">
    <!-- 图片区 -->
    <div class="zcc-img-wrap">
      <img v-if="images.length > 0" :src="images[0]" :alt="listing.title" class="zcc-img" />
      <div v-else class="zcc-img-empty">
        <span></span>
      </div>

      <!-- 多图角标 -->
      <span v-if="images.length > 1" class="zcc-img-counter">+{{ images.length - 1 }}</span>

      <!-- 类型徽章 -->
      <span
        class="zcc-type-badge"
        :style="{
          background: typeMap[listing.type].bg,
          color: typeMap[listing.type].color,
        }"
      >{{ typeMap[listing.type].text }}</span>
    </div>

    <!-- 信息区 -->
    <div class="zcc-body">
      <h3 class="zcc-title">{{ listing.title }}</h3>

      <!-- 属性摘要：成色 + 品牌（如有） -->
      <div class="zcc-meta">
        <span
          v-if="listing.condition"
          class="zcc-tag"
          :style="{ color: conditionColor[listing.condition] || '#6b7280', borderColor: (conditionColor[listing.condition] || '#6b7280') + '40' }"
        >{{ listing.condition }}</span>
        <span v-if="listing.attributes?.['品牌']" class="zcc-tag">{{ listing.attributes['品牌'] }}</span>
      </div>

      <!-- 价格 -->
      <div class="zcc-price-row">
        <span v-if="listing.price" class="zcc-price">¥{{ listing.price }}</span>
        <span v-else class="zcc-price-negotiable">议价</span>
        <span v-if="hasFreeShipping" class="zcc-shipping">包邮</span>
      </div>

      <!-- 底部：卖家 + 想要数 -->
      <div class="zcc-footer">
        <div class="zcc-owner">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="cn" class="zcc-avatar" />
          <span class="zcc-owner-cn">{{ cn }}</span>
        </div>
        <span v-if="wantsCount > 0" class="zcc-wants">{{ wantsCount }} 人想要</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zcc {
  background: var(--kizuna-bg-elevated);
  border-radius: var(--kizuna-radius-md);
  overflow: hidden;
  border: 1px solid var(--kizuna-border);
  cursor: pointer;
  transition: all 0.18s var(--kizuna-ease);
  display: flex;
  flex-direction: column;
}

.zcc:hover {
  transform: translateY(-2px);
  border-color: var(--kizuna-border-strong);
  box-shadow: var(--kizuna-shadow-sm);
}

.zcc:active {
  transform: scale(0.98);
}

.zcc-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: var(--kizuna-bg);
  overflow: hidden;
}

.zcc-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.zcc-img-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--kizuna-bg) 0%, var(--kizuna-border) 100%);
  font-size: 40px;
  opacity: 0.5;
}

.zcc-img-counter {
  position: absolute;
  bottom: 6px;
  right: 6px;
  font-size: 10px;
  padding: 2px 7px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  border-radius: 999px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}

.zcc-type-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.zcc-body {
  padding: 8px 10px 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.zcc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--kizuna-text);
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.zcc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 2px;
}

.zcc-tag {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--kizuna-bg);
  border: 1px solid var(--kizuna-border);
  border-radius: 6px;
  color: var(--kizuna-text-soft);
  line-height: 1.5;
  white-space: nowrap;
}

.zcc-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 2px;
}

.zcc-price {
  font-size: 15px;
  font-weight: 700;
  color: var(--kizuna-status-active);
  letter-spacing: -0.02em;
}

.zcc-price-negotiable {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  padding: 2px 6px;
  background: var(--kizuna-bg);
  border-radius: 6px;
}

.zcc-shipping {
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(21, 101, 192, 0.12);
  color: #1565c0;
  border-radius: 6px;
  font-weight: 500;
}

.zcc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 4px;
  border-top: 1px dashed var(--kizuna-border);
}

.zcc-owner {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.zcc-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--kizuna-bg-elevated);
  flex-shrink: 0;
}

.zcc-owner-cn {
  font-size: 11px;
  color: var(--kizuna-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zcc-wants {
  font-size: 10px;
  color: var(--kizuna-text-faint);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>