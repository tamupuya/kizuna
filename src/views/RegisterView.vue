<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useKizunaStore } from '../stores/kizuna'

const router = useRouter()
const auth = useAuthStore()
const store = useKizunaStore()

const email = ref('')
const password = ref('')
const password2 = ref('')
const errorMsg = ref('')

async function submit() {
  errorMsg.value = ''

  if (!email.value.trim()) {
    errorMsg.value = '请输入邮箱'
    return
  }
  if (password.value.length < 6) {
    errorMsg.value = '密码至少 6 位'
    return
  }
  if (password.value !== password2.value) {
    errorMsg.value = '两次密码不一致'
    return
  }

  const session = await auth.signUp(email.value, password.value)
  if (!session) {
    errorMsg.value = friendlyError(auth.error)
    return
  }

  // 注册成功：有 session（确认 confirm email 已关）
  // 在 public.users 创建占位记录（trigger 会自动建，这里是兑底）
  if (auth.authUid) {
    await store.ensureUserRowFromAuth(auth.authUid, email.value)
  }

  router.push('/editor')
}

function friendlyError(msg: string | null): string {
  if (!msg) return '注册失败'
  if (msg.includes('already registered')) return '该邮箱已注册，去登录'
  if (msg.includes('Password should be')) return '密码强度不够（≥6 位）'
  if (msg.includes('rate limit')) return '请求过快，稍后再试'
  if (msg.includes('Email not confirmed')) return 'Supabase 未关闭邮箱验证：请到 Dashboard 关闭'
  return msg
}

function goLogin() {
  router.push('/login')
}

function back() {
  router.back()
}
</script>

<template>
  <div class="rv-page">
    <header class="rv-header">
      <button class="rv-back" @click="back">←</button>
    </header>

    <main class="rv-main">
      <div class="rv-card">
        <h1 class="rv-title">注册絆</h1>
        <p class="rv-desc">创建你的账号，开始二次元扩列</p>

        <input
          v-model="email"
          type="email"
          class="rv-input"
          placeholder="邮箱/手机号码"
          autocomplete="email"
        />

        <input
          v-model="password"
          type="password"
          class="rv-input"
          placeholder="密码"
          autocomplete="new-password"
        />

        <input
          v-model="password2"
          type="password"
          class="rv-input"
          placeholder="请再次输入密码"
          autocomplete="new-password"
          @keydown.enter="submit"
        />

        <div v-if="errorMsg" class="rv-error">{{ errorMsg }}</div>

        <button
          class="rv-cta"
          :disabled="auth.loading"
          @click="submit"
        >
          {{ auth.loading ? '注册中...' : '注册并创建人设卡' }}
        </button>

        <button class="rv-cta-secondary" @click="goLogin">
          已有账号？去登录
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.rv-page {
  min-height: 100vh;
  background: #fafaf8;
  display: flex;
  flex-direction: column;
}

.rv-header {
  padding: 14px 16px;
}

.rv-back {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.rv-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.rv-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 36px 28px;
  text-align: center;
  border: 1px solid #f0ede5;
  max-width: 360px;
  width: 100%;
}

.rv-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

.rv-title {
  font-size: 22px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 6px;
}

.rv-desc {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 18px;
  line-height: 1.6;
}

.rv-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e8e6e1;
  border-radius: 10px;
  background: #fafaf8;
  font-size: 14px;
  color: #2b2a26;
  outline: none;
  margin-bottom: 10px;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.rv-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.rv-error {
  font-size: 12px;
  color: #c44545;
  margin-bottom: 8px;
  text-align: left;
  padding: 0 4px;
}

.rv-cta {
  width: 100%;
  padding: 13px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-bottom: 8px;
  transition: background 0.18s ease;
}

.rv-cta:hover:not(:disabled) {
  background: #3a3528;
}

.rv-cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rv-cta-secondary {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: #fafaf8;
  color: #2b2a26;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #e8e6e1;
  cursor: pointer;
  margin-top: 8px;
}
</style>