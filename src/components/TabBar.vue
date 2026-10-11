<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useKizunaStore } from '../stores/kizuna'

const route = useRoute()
const router = useRouter()
const store = useKizunaStore()

const currentTab = computed(() => {
  const p = route.path
  if (p === '/home' || p === '/') return 'home'
  if (p.startsWith('/zhonggu') || p.startsWith('/radar/room') || p.startsWith('/radar/launch')) return 'zhonggu'
  if (p.startsWith('/add')) return 'add'
  if (p.startsWith('/messages')) return 'messages'
  if (p.startsWith('/profile') || p.startsWith('/settings') || p.startsWith('/editor') || p.startsWith('/intent')) return 'profile'
  return ''
})

const tabs = [
  { name: 'home', label: '首页', icon: 'home', path: '/home' },
  { name: 'zhonggu', label: '中谷店', icon: 'zhonggu', path: '/zhonggu' },
  { name: 'add', label: '', icon: 'add', path: '/add' },
  { name: 'messages', label: '消息', icon: 'messages', path: '/messages' },
  { name: 'profile', label: '我的', icon: 'profile', path: '/profile' },
]

function go(path: string) {
  router.push(path)
}

const showBadge = computed(() => store.unreadCount > 0)
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="t in tabs"
      :key="t.name"
      @click="go(t.path)"
      class="tab-item"
      :class="{
        'tab-item-active': currentTab === t.name,
        'tab-item-add': t.name === 'add'
      }"
    >
      <div class="tab-icon-wrap">
        <svg v-if="t.icon === 'home'" viewBox="0 0 24 24" class="tab-icon">
          <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1V10.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
        <svg v-else-if="t.icon === 'zhonggu'" viewBox="0 0 24 24" class="tab-icon">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
          <path d="M3 9h18" stroke="currentColor" stroke-width="1.6"/>
          <path d="M9 5V3M15 5V3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <span v-else-if="t.icon === 'add'" class="tab-add-glyph">+</span>
        <svg v-else-if="t.icon === 'messages'" viewBox="0 0 24 24" class="tab-icon">
          <path d="M4 5h16a1 1 0 011 1v11a1 1 0 01-1 1H8l-4 4V6a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
        <svg v-else-if="t.icon === 'profile'" viewBox="0 0 24 24" class="tab-icon">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
          <path d="M4 21c0-4.418 3.582-7 8-7s8 2.582 8 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>

        <!-- 红点（消息） -->
        <span
          v-if="t.name === 'messages' && showBadge"
          class="tab-badge"
        >{{ store.unreadCount > 9 ? '9+' : store.unreadCount }}</span>
      </div>
      <span v-if="t.name !== 'add'" class="tab-label">{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--kizuna-bg-elevated);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--kizuna-border);
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
  z-index: 100;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 0;
  color: var(--kizuna-text-faint);
  transition: all 0.18s var(--kizuna-ease);
  position: relative;
}

.tab-item:active {
  transform: scale(0.94);
}

.tab-item-active {
  color: var(--kizuna-primary);
}

.tab-item-active .tab-label {
  font-weight: 700;
}

.tab-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  position: relative;
  transition: transform 0.18s var(--kizuna-ease);
}

.tab-item-active .tab-icon-wrap {
  transform: translateY(-2px);
}

.tab-icon {
  width: 24px;
  height: 24px;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

/* 中间 "+" 按钮：悬浮凸出 */
.tab-item-add {
  color: var(--kizuna-primary-soft);
  flex: 0 0 64px;
  position: relative;
}

.tab-item-add .tab-icon-wrap {
  width: 54px;
  height: 54px;
  background: var(--kizuna-grad-cta);
  color: var(--kizuna-primary);
  border-radius: 50%;
  margin-bottom: -4px;
  box-shadow: var(--kizuna-shadow-md);
  position: relative;
  transition: transform 0.18s var(--kizuna-ease);
}

.tab-item-add:hover .tab-icon-wrap {
  transform: translateY(-2px) scale(1.05);
  box-shadow: var(--kizuna-shadow-lg);
}

.tab-item-add:active .tab-icon-wrap {
  transform: scale(0.95);
}

/* 浮起光晕环 */
.tab-item-add .tab-icon-wrap::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--kizuna-grad-cta);
  opacity: 0.25;
  z-index: -1;
  filter: blur(8px);
}

.tab-add-glyph {
  font-size: 28px;
  font-weight: 300;
  line-height: 1;
  color: #ffffff;
}

/* 红点 */
.tab-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--kizuna-status-error);
  color: var(--kizuna-primary-soft);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--kizuna-bg-elevated);
  animation: kz-bounce-soft 1.5s ease-in-out infinite;
}

@keyframes kz-bounce-soft {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.1); }
}
</style>