<script setup lang="ts">
import { useAlertStore } from '../stores/alert'

const alertStore = useAlertStore()

const emojis = {
  success: '✓',
  info: 'i',
  warn: '!',
  error: '×',
} as const
</script>

<template>
  <Teleport to="body">
    <div class="alerts-stack" aria-live="polite">
      <TransitionGroup name="toast" tag="div" class="alerts-list">
        <div
          v-for="a in alertStore.alerts"
          :key="a.id"
          class="alert"
          :class="`alert-${a.kind}`"
          @click="alertStore.dismiss(a.id)"
        >
          <div class="alert-icon">{{ emojis[a.kind] }}</div>
          <div class="alert-content">
            <div class="alert-title">{{ a.title }}</div>
            <div v-if="a.body" class="alert-body">{{ a.body }}</div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- MUJI 风格确认弹窗（替代原生 confirm） -->
    <Teleport to="body">
      <Transition name="cf">
        <div v-if="alertStore.confirmState" class="confirm-mask" @click.self="alertStore.resolveConfirm(false)">
          <div class="confirm-card">
            <div class="confirm-title">{{ alertStore.confirmState.title }}</div>
            <div v-if="alertStore.confirmState.body" class="confirm-body">{{ alertStore.confirmState.body }}</div>
            <div class="confirm-actions">
              <button class="cf-btn cf-btn-cancel" @click="alertStore.resolveConfirm(false)">
                {{ alertStore.confirmState.cancelText || '取消' }}
              </button>
              <button
                class="cf-btn cf-btn-ok"
                :class="{ 'cf-btn-danger': alertStore.confirmState.danger }"
                @click="alertStore.resolveConfirm(true)"
              >
                {{ alertStore.confirmState.confirmText || '确定' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </Teleport>
</template>

<style scoped>
.alerts-stack {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
  width: 100%;
  max-width: 420px;
  padding: 0 16px;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.alert {
  background: #2b2a26;
  color: #fff5dc;
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  max-width: 380px;
  pointer-events: auto;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  border-left: 4px solid #b8ad95;
}

.alert-success {
  border-left-color: #7fb069;
}

.alert-error {
  border-left-color: #d17575;
}

.alert-warn {
  border-left-color: #e9b04a;
}

.alert-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff5dc;
  color: #2b2a26;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert-success .alert-icon {
  background: #7fb069;
  color: #fff;
}

.alert-error .alert-icon {
  background: #d17575;
  color: #fff;
}

.alert-warn .alert-icon {
  background: #e9b04a;
  color: #fff;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.alert-body {
  font-size: 12px;
  color: rgba(255, 245, 220, 0.78);
  line-height: 1.4;
  margin-top: 2px;
}

/* Slide animation */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.28s cubic-bezier(.34,1.56,.64,1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ===== 确认弹窗（MUJI 风格） ===== */
.confirm-mask {
  position: fixed;
  inset: 0;
  background: rgba(43, 42, 38, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 0 28px;
}
.confirm-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 22px 20px 16px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
}
.confirm-title {
  font-size: 16px;
  font-weight: 700;
  color: #2b2a26;
  line-height: 1.45;
  margin-bottom: 6px;
}
.confirm-body {
  font-size: 13px;
  color: #5c5953;
  line-height: 1.6;
  margin-bottom: 18px;
  white-space: pre-wrap;
}
.confirm-actions {
  display: flex;
  gap: 10px;
}
.cf-btn {
  flex: 1;
  padding: 11px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid #e8e6e1;
  cursor: pointer;
  background: #ffffff;
  color: #5c5953;
  transition: all 0.15s ease;
}
.cf-btn:active {
  opacity: 0.75;
}
.cf-btn-cancel {
  background: #f5f3ee;
}
.cf-btn-ok {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}
.cf-btn-danger {
  background: #c44545;
  border-color: #c44545;
  color: #ffffff;
}

.cf-enter-active,
.cf-leave-active {
  transition: opacity 0.18s ease;
}
.cf-enter-active .confirm-card,
.cf-leave-active .confirm-card {
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
}
.cf-enter-from,
.cf-leave-to {
  opacity: 0;
}
.cf-enter-from .confirm-card,
.cf-leave-to .confirm-card {
  transform: scale(0.94);
}
</style>