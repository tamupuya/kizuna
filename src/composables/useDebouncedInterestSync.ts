import { ref, watch } from 'vue'

/**
 * v0.4.1: 防抖同步 composable
 * 监听一个 ref，连续变化 N ms 后才触发同步。
 * 用法：
 *   const { sync } = useDebouncedInterestSync(saveFn)
 *   sync(interestCategories)
 *   // 或 watch(interestCategories, sync)
 */

export function useDebouncedInterestSync(
  syncFn: (val: any[]) => void | Promise<void>,
  delay = 500
) {
  const isSyncing = ref(false)
  const lastSyncedAt = ref<Date | null>(null)

  let timer: number | null = null
  let pendingVal: any[] | null = null

  function sync(val: any[]) {
    pendingVal = val
    if (timer !== null) {
      window.clearTimeout(timer)
    }
    timer = window.setTimeout(async () => {
      if (!pendingVal) return
      const v = pendingVal
      pendingVal = null
      isSyncing.value = true
      try {
        await syncFn(v)
        lastSyncedAt.value = new Date()
      } finally {
        isSyncing.value = false
      }
    }, delay)
  }

  function flush() {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    if (pendingVal !== null) {
      const v = pendingVal
      pendingVal = null
      isSyncing.value = true
      Promise.resolve(syncFn(v)).finally(() => {
        isSyncing.value = false
        lastSyncedAt.value = new Date()
      })
    }
  }

  // 页面关闭前强制同步
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }

  return {
    sync,
    flush,
    isSyncing,
    lastSyncedAt,
  }
}
