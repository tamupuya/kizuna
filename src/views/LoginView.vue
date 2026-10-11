<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const errorMsg = ref('')

async function submit() {
  if (!email.value.trim() || !password.value) {
    errorMsg.value = '请输入邮箱和密码'
    return
  }
  errorMsg.value = ''
  const session = await auth.signIn(email.value, password.value)
  if (!session) {
    errorMsg.value = friendlyError(auth.error)
    return
  }
  // 登录成功：跳到首页（路由守卫会再次检查人设卡完整性）
  // v0.10 修复（2026-10-03）：/radar 路由不存在 → 白屏；落首页
  router.push('/home')
}

function friendlyError(msg: string | null): string {
  if (!msg) return '登录失败'
  if (msg.includes('Invalid login credentials')) return '邮箱或密码错误'
  if (msg.includes('Email not confirmed')) return '邮箱未验证（请确认 Supabase 已关闭 confirm email）'
  return msg
}

function goRegister() {
  router.push('/register')
}

function back() {
  router.back()
}
</script>

<template>
  <div class="lv-page">
    <header class="lv-header">
      <button class="lv-back" @click="back">←</button>
    </header>

    <main class="lv-main">
      <div class="lv-card">
        <h1 class="lv-title">登录絆</h1>
        <p class="lv-desc">欢迎回来</p>

        <input
          v-model="email"
          type="email"
          class="lv-input"
          placeholder=""
          autocomplete="email"
        />

        <input
          v-model="password"
          type="password"
          class="lv-input"
          placeholder="密码"
          autocomplete="current-password"
          @keydown.enter="submit"
        />

        <div v-if="errorMsg" class="lv-error">{{ errorMsg }}</div>

        <button
          class="lv-cta"
          :disabled="auth.loading"
          @click="submit"
        >
          {{ auth.loading ? '登录中...' : '登录' }}
        </button>

        <button class="lv-cta-secondary" @click="goRegister">
          还没有账号？去注册
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.lv-page {
  min-height: 100vh;
  background: #fafaf8;
  display: flex;
  flex-direction: column;
}

.lv-header {
  padding: 14px 16px;
}

.lv-back {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.lv-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lv-card {
  background: #ffffff;
  border-radius: 18px;
  padding: 36px 28px;
  text-align: center;
  border: 1px solid #f0ede5;
  max-width: 360px;
  width: 100%;
}

.lv-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

.lv-title {
  font-size: 22px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 6px;
}

.lv-desc {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 18px;
  line-height: 1.6;
}

.lv-input {
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

.lv-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.lv-error {
  font-size: 12px;
  color: #c44545;
  margin-bottom: 8px;
  text-align: left;
  padding: 0 4px;
}

.lv-cta {
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

.lv-cta:hover:not(:disabled) {
  background: #3a3528;
}

.lv-cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lv-cta-secondary {
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