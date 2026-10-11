<script setup lang="ts">
import { ref, computed } from 'vue'

type Aspect = '3/4' | '1/1'

const props = withDefaults(
  defineProps<{
    ocName?: string
    ocBio?: string
    ocWorld?: string
    ocIllust?: string
    ocTags?: string[]
    ocDescText?: string
    /** 图片的比例：'3/4' 图片充满整个 3/4 卡片；'1/1' 图片为正方形顶部，下方黑底补足（卡片整体仍是 3/4） */
    aspect?: Aspect
    /** 显示左上角编辑按钮 */
    editable?: boolean
    /** 显示右上角关闭按钮 */
    closable?: boolean
    /** 编辑器内部预览态：隐藏所有按钮 */
    editing?: boolean
  }>(),
  {
    ocName: '',
    ocBio: '',
    ocWorld: '',
    ocIllust: '',
    ocTags: () => [],
    ocDescText: '',
    aspect: '3/4',
    editable: false,
    closable: false,
    editing: false,
  },
)

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'close'): void
}>()

const expanded = ref(false)

let startY = 0
let startX = 0
function onTouchStart(e: TouchEvent) {
  startY = e.touches[0].clientY
  startX = e.touches[0].clientX
}
function onTouchMove(e: TouchEvent) {
  if (startY === 0) return
  const dy = e.touches[0].clientY - startY
  const dx = e.touches[0].clientX - startX
  if (Math.abs(dy) < 28 || Math.abs(dx) > Math.abs(dy)) return
  if (dy < 0 && !expanded.value) expanded.value = true
  else if (dy > 0 && expanded.value && dy > 40) expanded.value = false
  startY = 0
}
function toggle() {
  expanded.value = !expanded.value
}

const hasIllust = computed(() => !!props.ocIllust)
const tagList = computed(() => (Array.isArray(props.ocTags) ? props.ocTags : []))
const isOneOne = computed(() => props.aspect === '1/1')
const showEditBtn = computed(() => props.editable && !props.editing)
const showCloseBtn = computed(() => props.closable && !props.editing)
</script>

<template>
  <!--
    OC 卡：卡片本体恒定 3:4 纵向
    - aspect=3/4：图片 cover 充满整个 3:4 卡片，下方毛玻璃浮层
    - aspect=1/1：图片按 1:1 正方形位于顶部，下半纯黑底补足到 3:4
  -->
  <div
    class="oc-card"
    :class="['art-' + aspect.replace('/', '-'), { 'is-expanded': expanded }]"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
  >
    <!-- 立绘区域：3:4 时 cover 充满；1:1 时按 1:1 比例显示在顶部 -->
    <div class="oc-art" :class="{ 'art-1-1': isOneOne }">
      <img
        v-if="hasIllust"
        :src="ocIllust"
        alt="OC 立绘"
        class="oc-art-img"
        @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
      />
      <div v-else class="oc-art-placeholder">
        <span>暂无立绘</span>
        <small>在编辑器中上传图片</small>
      </div>
    </div>

    <!-- 信息浮层：
         - 3:4 时用毛玻璃（图片盖满，黑底在图片下方有毛玻璃覆盖）
         - 1:1 时图片只到顶部正方形，下半纯黑底独立信息区 -->
    <div v-if="isOneOne" class="oc-bottom-info">
      <div v-if="!expanded" class="oc-info-collapsed" @click="toggle">
        <div class="oc-name">{{ ocName || '未命名 OC' }}</div>
        <div v-if="ocBio" class="oc-bio">{{ ocBio }}</div>
        <div class="oc-swipe-hint">
          <span class="oc-swipe-arrow">︿</span>
          <span>上滑查看更多</span>
        </div>
      </div>
    </div>

    <div v-else class="oc-glass" :class="{ 'is-expanded': expanded }">
      <div class="oc-content" :class="{ 'is-expanded': expanded }" @click="!expanded && toggle()">
        <template v-if="!expanded">
          <div class="oc-name">{{ ocName || '未命名 OC' }}</div>
          <div v-if="ocBio" class="oc-bio">{{ ocBio }}</div>
          <div class="oc-swipe-hint">
            <span class="oc-swipe-arrow">︿</span>
            <span>上滑查看更多</span>
          </div>
        </template>
      </div>
    </div>

    <!-- 展开态 -->
    <transition name="oc-expand">
      <div v-if="expanded" class="oc-expand-pane" :class="{ 'is-1-1': isOneOne }">
        <div class="oc-expand-inner">
          <div class="oc-expand-head">
            <div>
              <div class="oc-name">{{ ocName || '未命名 OC' }}</div>
              <div v-if="ocBio" class="oc-bio oc-bio-lg">{{ ocBio }}</div>
            </div>
            <button class="oc-collapse" @click.stop="toggle">收起 ⌄</button>
          </div>

          <div v-if="ocWorld" class="oc-block">
            <div class="oc-block-label">世界观 / 设定</div>
            <div class="oc-block-text">{{ ocWorld }}</div>
          </div>

          <div v-if="hasIllust" class="oc-block">
            <div class="oc-block-label">立绘链接</div>
            <a class="oc-link" :href="ocIllust" target="_blank" rel="noopener">{{ ocIllust }}</a>
          </div>

          <div v-if="tagList.length" class="oc-block">
            <div class="oc-block-label">标签</div>
            <div class="oc-tags">
              <span v-for="t in tagList" :key="t" class="oc-tag">{{ t }}</span>
            </div>
          </div>

          <div v-if="ocDescText" class="oc-block">
            <div class="oc-block-label">详细描述</div>
            <div class="oc-block-text oc-desc">{{ ocDescText }}</div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 左上编辑按钮 -->
    <button v-if="showEditBtn" class="oc-corner oc-edit" @click.stop="emit('edit')" aria-label="编辑">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>

    <!-- 右上 X 关闭按钮 -->
    <button v-if="showCloseBtn" class="oc-corner oc-close" @click.stop="emit('close')" aria-label="关闭">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* 卡片本体恒定 3:4 纵向 */
.oc-card {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 78vh;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(160deg, #2a3a4d 0%, #131c27 100%);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  user-select: none;
}

/* 图片区域：3:4 时 cover 充满；1:1 时图片顶部 1:1 正方形 */
.oc-art {
  position: absolute;
  inset: 0;
}
.oc-art.art-1-1 {
  /* 1:1 时图片只到顶部 1:1（高度 = 宽度），下方由 .oc-bottom-info 黑底补足 */
  inset: 0 0 auto 0;
  height: 75%; /* 在 3:4 容器中，1:1 高度 = 容器宽度 / 容器宽度 = 容器宽度的 1 倍，约占容器 75% */
  aspect-ratio: 1 / 1;
}
.oc-art-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.oc-art-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
}
.oc-art-placeholder small {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

/* 1:1 时下半纯黑底信息区（与图片下沿衔接，无毛玻璃） */
.oc-bottom-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  /* 1:1 图片高度 = 容器宽度的 1 倍；容器高度 = 容器宽度 × 4/3；
     所以黑底高度 = 容器高度 - 图片高度 = 容器宽度 × 1/3 ≈ 容器高度的 25% */
  height: 25%;
  background: #2a2a35;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e8e8ef;
}
.oc-info-collapsed {
  padding: 14px 18px 16px;
  width: 100%;
}
.oc-info-collapsed .oc-name {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: #fff;
  text-shadow: none;
}
.oc-info-collapsed .oc-bio {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(232, 232, 239, 0.78);
}
.oc-info-collapsed .oc-swipe-hint {
  margin-top: 8px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: rgba(232, 232, 239, 0.6);
  font-size: 11px;
}

/* 3:4 时毛玻璃浮层 */
.oc-glass {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: linear-gradient(
    to top,
    rgba(10, 16, 24, 0.92) 0%,
    rgba(10, 16, 24, 0.62) 38%,
    rgba(10, 16, 24, 0) 70%
  );
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  transition: background 0.3s ease, backdrop-filter 0.3s ease;
  pointer-events: none;
}
.oc-glass > * { pointer-events: auto; }
.oc-glass.is-expanded {
  background: rgba(9, 14, 22, 0.74);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.oc-content {
  padding: 18px 18px 22px;
  color: #fff;
  max-height: 46%;
  overflow: hidden;
  transition: max-height 0.32s var(--kizuna-ease-out);
}
.oc-content.is-expanded {
  max-height: 100%;
  overflow-y: auto;
}

/* 通用名字样式 */
.oc-name {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
}
.oc-bio {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.86);
}
.oc-swipe-hint {
  margin-top: 14px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
}
.oc-swipe-arrow {
  font-size: 16px;
  line-height: 1;
  animation: kz-float 2.4s ease-in-out infinite;
}

/* 展开面板（覆盖底部，两种比例共用） */
.oc-expand-pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  z-index: 5;
  pointer-events: auto;
}
.oc-expand-pane:not(.is-1-1) {
  background: rgba(9, 14, 22, 0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.oc-expand-pane.is-1-1 {
  background: #2a2a35;
}
.oc-expand-inner {
  padding: 18px 18px 22px;
  max-height: 88%;
  overflow-y: auto;
  color: #fff;
}
.is-1-1 .oc-expand-inner {
  color: #e8e8ef;
}
.oc-expand-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.oc-collapse {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
.is-1-1 .oc-collapse {
  background: rgba(232, 232, 239, 0.1);
  border-color: rgba(232, 232, 239, 0.18);
  color: #e8e8ef;
}
.oc-bio-lg {
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.86);
}
.is-1-1 .oc-bio-lg {
  color: rgba(232, 232, 239, 0.78);
}

.oc-block {
  margin-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 12px;
}
.is-1-1 .oc-block {
  border-top-color: rgba(232, 232, 239, 0.14);
}
.oc-block-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #9fc0e0;
  margin-bottom: 6px;
}
.oc-block-text {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.92);
  white-space: pre-wrap;
  word-break: break-word;
}
.is-1-1 .oc-block-text {
  color: rgba(232, 232, 239, 0.92);
}
.oc-desc {
  max-height: 38vh;
  overflow-y: auto;
}
.oc-link {
  font-size: 13px;
  color: #9fc0e0;
  word-break: break-all;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.oc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.oc-tag {
  font-size: 12px;
  padding: 4px 11px;
  border-radius: 999px;
  background: rgba(107, 140, 174, 0.28);
  border: 1px solid rgba(107, 140, 174, 0.5);
  color: #dce9f5;
}

/* 角部按钮 */
.oc-corner {
  position: absolute;
  top: 10px;
  z-index: 10;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.92);
  color: #2b2a26;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease, background 0.15s ease;
}
.oc-corner:hover { background: #fff; transform: scale(1.05); }
.oc-edit { left: 10px; border-radius: 10px; }
.oc-close { right: 10px; border-radius: 999px; }

/* 展开过渡 */
.oc-expand-enter-active,
.oc-expand-leave-active {
  transition: opacity 0.32s var(--kizuna-ease-out);
}
.oc-expand-enter-from,
.oc-expand-leave-to {
  opacity: 0;
}
</style>