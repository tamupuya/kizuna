<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const store = useKizunaStore()
const auth = useAuthStore()

onMounted(async () => {
  try {
    if (!auth.initialized) {
      await auth.init()
    }
    if (auth.isLoggedIn) {
      await store.fetchUsers()
      await store.syncCurrentUserFromAuth(auth.authUid)
      if (store.hasUser && store.currentUser) {
        // v0.10 修复（2026-10-03）：/radar 路由不存在 → 白屏；落首页
        router.replace('/home')
        return
      }
      router.replace('/editor')
      return
    }
  } catch (e) {
    console.error('[SelectView] init failed:', e)
    // 静默失败，保留在登录页
  }
})

const features = [
  { title: '人设卡', desc: '同好匹配，看见彼此的喜好' },
  { title: '漫展', desc: '看看这一场还有谁' },
  { title: '中谷店', desc: '' },
]

function goRegister() {
  router.push('/register')
}
function goLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="sv-page">
    <!-- 背景装饰 -->
    <div class="sv-bg-glow sv-bg-glow-1"></div>
    <div class="sv-bg-glow sv-bg-glow-2"></div>

    <!-- 顶部品牌头 -->
    <header class="sv-header kz-rise">
      <div class="sv-brand">
        <div class="sv-logo-mark">絆</div>
        <div>
          <div class="sv-logo-text">绊</div>
          <div class="sv-logo-sub">KIZUNA</div>
        </div>
      </div>
      <div class="sv-tagline">漫展同好连接工具</div>
    </header>

    <main class="sv-main">
      <!-- Hero -->
      <section class="sv-hero kz-rise" style="animation-delay: 0.15s">
        <h1 class="sv-hero-title">
          在漫展，
          <br />和同好<span class="sv-highlight">遇见彼此</span>
        </h1>
        <p class="sv-hero-desc">
          创建账号 · 完善人设卡<br />
          在漫展上高效扩列，互转谷子
        </p>
      </section>

      <!-- 3 大能力 -->
      <section class="sv-features">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          class="sv-feature-card kz-rise"
          :style="`animation-delay: ${0.3 + i * 0.1}s`"
        >
          <div class="sv-feature-body">
            <h3 class="sv-feature-title">{{ f.title }}</h3>
            <p class="sv-feature-desc">{{ f.desc }}</p>
          </div>
        </article>
      </section>

      <!-- CTA -->
      <div class="sv-cta-area kz-rise" style="animation-delay: 0.7s">
        <button @click="goRegister" class="sv-cta-primary kz-tap">
          <span>开始创建账号</span>
          <span class="sv-cta-arrow">→</span>
        </button>
        <button @click="goLogin" class="sv-cta-secondary kz-tap">
          已有账号 · 登录
        </button>
      </div>

      <!-- 信任提示 -->
      <p class="sv-trust kz-fade-in" style="animation-delay: 0.9s">
        不碰钱 · 不担保 · 不打扰 · 只做连接
      </p>
    </main>

    <!-- 底部 -->
    <footer class="sv-footer kz-fade-in" style="animation-delay: 1.0s">
      <span>绊 v0.10.4</span>
      <span class="sv-footer-dot">·</span>
      <span>非交易平台</span>
    </footer>
  </div>
</template>

<style scoped>
.sv-page {
  min-height: 100vh;
  background: var(--kizuna-grad-brand);
  padding: 24px 20px 32px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  font-family: var(--kizuna-font-family);
}

/* 背景光斑 */
.sv-bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.6;
  pointer-events: none;
}

.sv-bg-glow-1 {
  top: -15%;
  right: -20%;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, #fff5dc 0%, transparent 70%);
  animation: kz-float 6s ease-in-out infinite;
}

.sv-bg-glow-2 {
  bottom: -20%;
  left: -20%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, #f0ede5 0%, transparent 70%);
  animation: kz-float 7s ease-in-out infinite reverse;
}

/* 顶部品牌头 */
.sv-header {
  text-align: center;
  padding: 16px 0 24px;
  position: relative;
  z-index: 1;
}

.sv-brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.sv-logo-mark {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--kizuna-grad-cta);
  color: var(--kizuna-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  box-shadow: var(--kizuna-shadow-md);
}

.sv-logo-text {
  font-size: 32px;
  font-weight: 700;
  color: var(--kizuna-primary);
  letter-spacing: 0.15em;
  line-height: 1;
  text-align: left;
}

.sv-logo-sub {
  font-size: 11px;
  color: var(--kizuna-text-faint);
  letter-spacing: 0.4em;
  font-weight: 500;
  margin-top: 4px;
  text-align: left;
}

.sv-tagline {
  font-size: 13px;
  color: var(--kizuna-text-soft);
  letter-spacing: 0.05em;
}

/* 主区 */
.sv-main {
  flex: 1;
  max-width: 420px;
  margin: 0 auto;
  width: 100%;
  position: relative;
  z-index: 1;
}

/* Hero */
.sv-hero {
  text-align: center;
  margin: 16px 0 28px;
}

.sv-hero-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--kizuna-text);
  letter-spacing: -0.02em;
  margin: 0 0 12px;
  line-height: 1.3;
}

.sv-highlight {
  background: linear-gradient(180deg, transparent 60%, var(--kizuna-primary-soft) 60%);
  padding: 0 4px;
}

.sv-hero-desc {
  font-size: 14px;
  color: var(--kizuna-text-soft);
  line-height: 1.7;
  margin: 0;
  padding: 0 8px;
}

/* 3 大能力卡 */
.sv-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}

.sv-feature-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--kizuna-bg-elevated);
  border-radius: var(--kizuna-radius-lg);
  border: 1px solid var(--kizuna-border);
  box-shadow: var(--kizuna-shadow-sm);
  transition: all 0.18s var(--kizuna-ease);
}

.sv-feature-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--kizuna-shadow-md);
  border-color: var(--kizuna-border-strong);
}

.sv-feature-emoji {
  font-size: 28px;
  width: 48px;
  height: 48px;
  border-radius: var(--kizuna-radius-md);
  background: var(--kizuna-primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sv-feature-body {
  flex: 1;
  min-width: 0;
}

.sv-feature-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--kizuna-text);
  margin: 0 0 2px;
}

.sv-feature-desc {
  font-size: 12px;
  color: var(--kizuna-text-soft);
  margin: 0;
  line-height: 1.5;
}

/* CTA */
.sv-cta-area {
  margin-bottom: 20px;
}

.sv-cta-primary {
  width: 100%;
  padding: 14px 20px;
  border-radius: var(--kizuna-radius-md);
  background: var(--kizuna-grad-cta);
  color: var(--kizuna-primary-soft);
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-bottom: 10px;
  transition: all 0.18s var(--kizuna-ease);
  box-shadow: var(--kizuna-shadow-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sv-cta-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--kizuna-shadow-lg);
}

.sv-cta-primary:active {
  transform: translateY(0) scale(0.98);
}

.sv-cta-arrow {
  transition: transform 0.18s var(--kizuna-ease);
}

.sv-cta-primary:hover .sv-cta-arrow {
  transform: translateX(4px);
}

.sv-cta-secondary {
  width: 100%;
  padding: 12px;
  border-radius: var(--kizuna-radius-md);
  background: var(--kizuna-bg-elevated);
  color: var(--kizuna-text);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--kizuna-border-strong);
  cursor: pointer;
  transition: all 0.18s ease;
}

.sv-cta-secondary:hover {
  background: var(--kizuna-bg);
  border-color: var(--kizuna-primary);
}

/* 信任提示 */
.sv-trust {
  font-size: 12px;
  color: var(--kizuna-text-faint);
  text-align: center;
  margin: 0;
  letter-spacing: 0.1em;
}

/* 底部 */
.sv-footer {
  text-align: center;
  font-size: 11px;
  color: var(--kizuna-text-faint);
  padding: 16px 0 0;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.sv-footer-dot {
  opacity: 0.5;
}
</style>