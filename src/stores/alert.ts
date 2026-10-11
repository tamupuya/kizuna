import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Alert {
  id: number
  kind: 'success' | 'info' | 'error' | 'warn'
  title: string
  body?: string
  ttl: number   // ms before auto-dismiss
}

export interface ConfirmState {
  title: string
  body?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  resolve: (v: boolean) => void
}

export const useAlertStore = defineStore('alert', () => {
  const alerts = ref<Alert[]>([])
  const confirmState = ref<ConfirmState | null>(null)
  let nextId = 1

  function show(
    kind: Alert['kind'],
    title: string,
    body?: string,
    ttl = 3500,
  ): number {
    const id = nextId++
    alerts.value.push({ id, kind, title, body, ttl })
    if (ttl > 0) {
      setTimeout(() => dismiss(id), ttl)
    }
    return id
  }

  function success(title: string, body?: string, ttl = 3000) {
    return show('success', title, body, ttl)
  }

  function info(title: string, body?: string, ttl = 3500) {
    return show('info', title, body, ttl)
  }

  function warn(title: string, body?: string, ttl = 4000) {
    return show('warn', title, body, ttl)
  }

  function error(title: string, body?: string, ttl = 5000) {
    return show('error', title, body, ttl)
  }

  function dismiss(id: number) {
    alerts.value = alerts.value.filter(a => a.id !== id)
  }

  // Promise-based 确认弹窗（替代原生 confirm，Capacitor WebView 兼容 + MUJI 风格）
  function confirm(
    title: string,
    body?: string,
    opts: { confirmText?: string; cancelText?: string; danger?: boolean } = {},
  ): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = {
        title,
        body,
        confirmText: opts.confirmText,
        cancelText: opts.cancelText,
        danger: opts.danger,
        resolve,
      }
    })
  }

  function resolveConfirm(v: boolean) {
    confirmState.value?.resolve(v)
    confirmState.value = null
  }

  return {
    alerts,
    confirmState,
    show,
    success,
    info,
    warn,
    error,
    dismiss,
    confirm,
    resolveConfirm,
  }
})
