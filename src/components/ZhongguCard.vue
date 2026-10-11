<script setup lang="ts">
import { computed } from 'vue'
import type { ZhongguListing, User, ListingStatus } from '../lib/mockData'
import { STATUS_META } from '../lib/mockData'

const props = defineProps<{
  listing: ZhongguListing
  owner?: User
  showActions?: boolean  // 2026-07-28：我的挂出页面是否显示下架/重新上架/删除按钮
  onArchive?: () => void
  onRestore?: () => void
  onDelete?: () => void
}>()

// v0.9.21-p1：点击卡片跳转详情页（空白页占位）
const emit = defineEmits<{
  (e: 'click', listingId: string): void
}>()

function onCardClick() {
  emit('click', props.listing.id)
}

const images = computed(() => {
  return ((props.listing as any).images as string[] | undefined) || []
})

const typeMap: Record<string, { text: string; bg: string; color: string; ring: string }> = {
  sell: { text: '出', bg: '#e3f2fd', color: '#1565c0', ring: 'rgba(21, 101, 192, 0.2)' },
  want: { text: '求', bg: '#fff5dc', color: '#5c4d2e', ring: 'rgba(92, 77, 46, 0.2)' },
  exchange: { text: '换', bg: '#f3e5f5', color: '#6a1b9a', ring: 'rgba(106, 27, 154, 0.2)' },
}

const statusMeta = computed(() => STATUS_META[props.listing.status as ListingStatus])

const tiltDeg = computed(() => {
  // 用 listing.id 算稳定倾斜（-2.5° ~ +2.5°）
  let hash = 0
  for (let i = 0; i < props.listing.id.length; i++) {
    hash = (hash * 31 + props.listing.id.charCodeAt(i)) >>> 0
  }
  return ((hash % 100) / 100 - 0.5) * 5
})
</script>

<template>
  <div class="zg-card kz-tap" :style="`--tilt: ${tiltDeg}deg`" @click="onCardClick">
    <!-- 拍立得厚边框 -->
    <div class="zg-frame">
      <div class="zg-image-wrap">
        <img v-if="images.length > 0" :src="images[0]" :alt="listing.title" class="zg-img" />
        <div v-else class="zg-img-empty">
          <span></span>
        </div>

        <span v-if="images.length > 1" class="zg-img-counter">+{{ images.length - 1 }}</span>

        <!-- 类型角标 -->
        <span
          class="zg-type-badge"
          :style="{
            background: typeMap[listing.type].bg,
            color: typeMap[listing.type].color,
            boxShadow: `0 4px 12px ${typeMap[listing.type].ring}`
          }"
        >{{ typeMap[listing.type].text }}</span>
      </div>
    </div>

    <!-- 信息区（白纸手写感） -->
    <div class="zg-paper">
      <div class="zg-meta-row">
        <span class="zg-ip">{{ listing.ip_tag }}</span>
        <span
          v-if="listing.status !== 'active'"
          class="zg-status-badge"
          :class="statusMeta.color"
        >{{ statusMeta.label }}</span>
      </div>

      <h3 class="zg-title">{{ listing.title }}</h3>

      <p v-if="listing.description" class="zg-desc">
        {{ listing.description.length > 50 ? listing.description.slice(0, 48) + '…' : listing.description }}
      </p>

      <div class="zg-bottom">
        <div v-if="owner" class="zg-owner">
          <img :src="owner.avatar_url" :alt="owner.cn" class="zg-owner-avatar" />
          <span class="zg-owner-cn">{{ owner.cn }}</span>
        </div>
        <div class="zg-right">
          <span v-if="listing.tags?.length" class="zg-tag" v-for="t in listing.tags.slice(0, 2)" :key="t">
            {{ t }}
          </span>
          <span v-if="listing.price" class="zg-price">¥{{ listing.price }}</span>
          <span v-else class="zg-price-negotiable">议价</span>
        </div>
      </div>

      <!-- 2026-07-28：我的挂出操作按钮 -->
      <div v-if="showActions" class="zg-actions">
        <button
          v-if="listing.status === 'active' || listing.status === 'reserved'"
          @click.stop.prevent="onArchive?.()"
          class="zg-act-btn zg-act-archive"
        >下架</button>
        <button
          v-if="listing.status === 'archived'"
          @click.stop.prevent="onRestore?.()"
          class="zg-act-btn zg-act-restore"
        >重新上架</button>
        <button
          v-if="listing.status === 'archived'"
          @click.stop.prevent="onDelete?.()"
          class="zg-act-btn zg-act-delete"
        >删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zg-card {
  --tilt: 0deg;
  position: relative;
  margin-bottom: 28px;
  cursor: pointer;
  transition: all 0.25s var(--kizuna-ease);
  transform: rotate(var(--tilt));
}

/* 鼠标悬停/触摸拍立得抬起 */
.zg-card:hover {
  transform: rotate(0deg) translateY(-4px) scale(1.02);
  z-index: 1;
}

.zg-card:active {
  transform: rotate(0deg) translateY(-2px) scale(1.0);
}

/* 拍立得厚边框 */
.zg-frame {
  background: var(--kizuna-bg-elevated);
  border-radius: 4px;
  padding: 12px 12px 16px;
  box-shadow: var(--kizuna-shadow-card);
  position: relative;
}

/* 撕角效果（左下） */
.zg-frame::before {
  content: '';
  position: absolute;
  bottom: -1px;
  left: -1px;
  width: 20px;
  height: 20px;
  background: linear-gradient(
    135deg,
    transparent 50%,
    var(--kizuna-bg) 50%,
    var(--kizuna-bg) 100%
  );
  border-bottom-left-radius: 4px;
}

.zg-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 2px;
  overflow: hidden;
  background: var(--kizuna-bg);
}

.zg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s var(--kizuna-ease);
}

.zg-card:hover .zg-img {
  transform: scale(1.04);
}

.zg-img-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--kizuna-bg) 0%, var(--kizuna-border) 100%);
  font-size: 56px;
  opacity: 0.5;
}

.zg-img-counter {
  position: absolute;
  bottom: 8px;
  right: 8px;
  font-size: 11px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  border-radius: 999px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}

.zg-type-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  backdrop-filter: blur(8px);
  transition: transform 0.18s var(--kizuna-ease);
}

.zg-card:hover .zg-type-badge {
  transform: scale(1.1) rotate(-8deg);
}

/* 信息区 */
.zg-paper {
  margin-top: 10px;
  padding: 0 4px;
}

.zg-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.zg-ip {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  font-weight: 500;
  letter-spacing: 0.05em;
}

.zg-status-badge {
  margin-left: auto;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.zg-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--kizuna-text);
  margin: 0 0 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.zg-desc {
  font-size: 12px;
  color: var(--kizuna-text-soft);
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.zg-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.zg-owner {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.zg-owner-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1.5px solid var(--kizuna-bg-elevated);
}

.zg-owner-cn {
  font-size: 12px;
  color: var(--kizuna-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zg-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.zg-tag {
  font-size: 10px;
  padding: 2px 7px;
  background: var(--kizuna-bg);
  border: 1px solid var(--kizuna-border);
  border-radius: 6px;
  color: var(--kizuna-text-soft);
}

.zg-price {
  font-size: 14px;
  font-weight: 700;
  color: var(--kizuna-status-active);
  letter-spacing: -0.02em;
}

.zg-price-negotiable {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  padding: 2px 7px;
  background: var(--kizuna-bg);
  border-radius: 6px;
}

/* 2026-07-28：我的挂出操作按钮 */
.zg-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--kizuna-border);
}

.zg-act-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  border: 1px solid var(--kizuna-border);
  background: var(--kizuna-bg-elevated);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s ease;
}

.zg-act-archive {
  color: #b45309;
  border-color: #fde68a;
  background: #fffbeb;
}
.zg-act-archive:hover {
  background: #fef3c7;
}

.zg-act-restore {
  color: #166534;
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.zg-act-restore:hover {
  background: #dcfce7;
}

.zg-act-delete {
  color: #991b1b;
  border-color: #fecaca;
  background: #fef2f2;
}
.zg-act-delete:hover {
  background: #fee2e2;
}
</style>