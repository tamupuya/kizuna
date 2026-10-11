<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const primaryActions = [
  {
    label: '挂出谷子',
    desc: '',
    action: () => router.push('/zhonggu/new'),
    color: 'warm',
    badge: '热门',
  },
  {
    label: '推窗',
    desc: '看看此刻还有谁在这里',
    action: () => router.push('/pair'),
    color: 'cool',
    badge: '新',
  },
  {
    label: '创建同窗会',
    desc: '发起临时房间，遇见同好',
    action: () => router.push('/radar/launch'),
    color: 'warm',
  },
]

// v0.10（2026-10-03）：原「更新意图」条目的 label 与 desc 在文案整理表中
// 均被标记为「不显示内容」→ 清空后会渲染成一个空白可点击卡片（点击仍跳 /intent），
// 属无效 UI。意图编辑在「我的」页仍有入口（我的意图 → /intent），故此处直接移除。
const secondaryActions = [
  {
    label: '编辑人设卡',
    desc: '更新内容',
    action: () => router.push('/editor'),
  },
]
</script>

<template>
  <div class="add-page">
    <div class="add-bg-glow add-bg-glow-1"></div>
    <div class="add-bg-glow add-bg-glow-2"></div>

    <div class="add-shell">
      <header class="add-header kz-rise">
        <h1 class="add-title">
          选一个
          <span class="add-title-emoji">→</span>
        </h1>
        <p class="add-sub">如果有人看上了咱家的物品，魔法兔子会通知您哦~</p>
      </header>

      <!-- 主要动作（大卡片） -->
      <section class="add-primary">
        <button
          v-for="(a, i) in primaryActions"
          :key="a.label"
          @click="a.action"
          class="add-primary-card kz-tap kz-rise"
          :class="`add-primary-${a.color}`"
          :style="`animation-delay: ${0.15 + i * 0.1}s`"
        >
          <span v-if="a.badge" class="add-badge">{{ a.badge }}</span>
          <div class="add-primary-body">
            <div class="add-primary-label">{{ a.label }}</div>
            <div class="add-primary-desc">{{ a.desc }}</div>
          </div>
          <span class="add-primary-arrow">→</span>
        </button>
      </section>

      <!-- 次要动作（小卡片网格） -->
      <section class="add-secondary">
        <button
          v-for="(a, i) in secondaryActions"
          :key="a.label"
          @click="a.action"
          class="add-secondary-card kz-tap kz-rise"
          :style="`animation-delay: ${0.5 + i * 0.08}s`"
        >
          <div>
            <div class="add-secondary-label">{{ a.label }}</div>
            <div class="add-secondary-desc">{{ a.desc }}</div>
          </div>
        </button>
      </section>

      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.add-page {
  min-height: 100vh;
  background: var(--kizuna-grad-brand);
  padding: 24px 20px calc(80px + env(safe-area-inset-bottom));
  position: relative;
  overflow: hidden;
  font-family: var(--kizuna-font-family);
}

.add-bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  pointer-events: none;
}

.add-bg-glow-1 {
  top: -10%;
  right: -20%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, #fff5dc 0%, transparent 70%);
  animation: kz-float 6s ease-in-out infinite;
}

.add-bg-glow-2 {
  bottom: -15%;
  left: -20%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, #f0ede5 0%, transparent 70%);
  animation: kz-float 7s ease-in-out infinite reverse;
}

.add-shell {
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.add-header {
  margin-bottom: 24px;
  padding: 0 4px;
}

.add-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: -0.02em;
  margin: 0 0 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-title-emoji {
  color: var(--kizuna-status-active);
  animation: kz-float 2s ease-in-out infinite;
}

.add-sub {
  font-size: 14px;
  color: var(--kizuna-text-soft);
  margin: 0;
}

/* 主动作卡 */
.add-primary {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.add-primary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: var(--kizuna-radius-lg);
  background: var(--kizuna-bg-elevated);
  border: 1px solid var(--kizuna-border);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s var(--kizuna-ease);
  box-shadow: var(--kizuna-shadow-sm);
  position: relative;
  overflow: hidden;
}

.add-primary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--kizuna-shadow-md);
  border-color: var(--kizuna-border-strong);
}

.add-primary-card:active {
  transform: translateY(0) scale(0.99);
}

.add-primary-warm {
  background: linear-gradient(135deg, #fff5dc 0%, #ffffff 100%);
}

.add-primary-cool {
  background: linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%);
}

.add-badge {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: var(--kizuna-radius-pill);
  background: var(--kizuna-primary);
  color: var(--kizuna-primary-soft);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.add-primary-emoji {
  font-size: 36px;
  width: 56px;
  height: 56px;
  border-radius: var(--kizuna-radius-md);
  background: var(--kizuna-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--kizuna-shadow-sm);
}

.add-primary-body {
  flex: 1;
  min-width: 0;
}

.add-primary-label {
  font-size: 17px;
  font-weight: 700;
  color: var(--kizuna-text);
  margin-bottom: 2px;
}

.add-primary-desc {
  font-size: 12px;
  color: var(--kizuna-text-soft);
  line-height: 1.5;
}

.add-primary-arrow {
  font-size: 24px;
  color: var(--kizuna-text-faint);
  flex-shrink: 0;
  transition: transform 0.18s var(--kizuna-ease);
}

.add-primary-card:hover .add-primary-arrow {
  transform: translateX(4px);
  color: var(--kizuna-text);
}

/* 次要动作卡 */
.add-secondary {
  display: grid;
  /* auto-fit：仅剩 1 个条目时自动占满整行，避免半宽空格 */
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}

.add-secondary-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border-radius: var(--kizuna-radius-lg);
  background: var(--kizuna-bg-elevated);
  border: 1px solid var(--kizuna-border);
  cursor: pointer;
  text-align: left;
  transition: all 0.18s var(--kizuna-ease);
}

.add-secondary-card:hover {
  transform: translateY(-1px);
  border-color: var(--kizuna-border-strong);
  box-shadow: var(--kizuna-shadow-sm);
}

.add-secondary-emoji {
  font-size: 24px;
}

.add-secondary-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--kizuna-text);
  margin-bottom: 2px;
}

.add-secondary-desc {
  font-size: 11px;
  color: var(--kizuna-text-soft);
  line-height: 1.4;
}

/* Tip（v0.10：原底部 tip 已被文案表标记为「不显示内容」，元素一并移除）*/

.safe-bottom {
  height: 24px;
}
</style>