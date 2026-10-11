import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/style.css'

// crypto.randomUUID 降级（旧 WebView 不支持）
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  const polyfill = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = Math.random() * 16 | 0
      const v = ch === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
  if (typeof globalThis.crypto === 'undefined') {
    ;(globalThis as any).crypto = { randomUUID: polyfill }
  } else {
    ;(globalThis.crypto as any).randomUUID = polyfill
  }
}

const app = createApp(App)
app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue Error]', err, info)
}

app.mount('#app')
