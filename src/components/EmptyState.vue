<script setup lang="ts">
defineProps<{
  emoji?: string
  title: string
  desc?: string
  primaryText?: string
  primaryAction?: () => void
  secondaryText?: string
  secondaryAction?: () => void
  variant?: 'default' | 'compact'
}>()
</script>

<template>
  <div class="empty-state kz-rise" :class="`empty-${variant || 'default'}`">
    <div v-if="emoji" class="empty-emoji">{{ emoji }}</div>
    <h3 class="empty-title">{{ title }}</h3>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <div v-if="primaryAction || secondaryAction" class="empty-actions">
      <button
        v-if="primaryAction"
        @click="primaryAction"
        class="kz-btn-primary"
      >{{ primaryText || '开始' }}</button>
      <button
        v-if="secondaryAction"
        @click="secondaryAction"
        class="kz-btn-ghost"
      >{{ secondaryText || '返回' }}</button>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  color: var(--kizuna-text-soft);
}

.empty-compact {
  padding: 24px 16px;
}

.empty-emoji {
  font-size: 56px;
  margin-bottom: 12px;
  opacity: 0.85;
  animation: kz-float 3s ease-in-out infinite;
}

.empty-compact .empty-emoji {
  font-size: 36px;
  margin-bottom: 8px;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--kizuna-text);
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

.empty-compact .empty-title {
  font-size: 14px;
}

.empty-desc {
  font-size: 13px;
  color: var(--kizuna-text-soft);
  margin: 0;
  line-height: 1.6;
  max-width: 280px;
}

.empty-compact .empty-desc {
  font-size: 12px;
  max-width: 240px;
}

.empty-actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 240px;
}
</style>