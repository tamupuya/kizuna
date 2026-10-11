<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'

const router = useRouter()
const store = useKizunaStore()

onMounted(async () => {
  // 让动画走完再跳转
  const start = Date.now()
  // 预热 store（不阻塞太久）
  if (store.users.length === 0) {
    try {
      await Promise.race([
        store.fetchUsers(),
        new Promise(r => setTimeout(r, 1200)),
      ])
    } catch {}
  }
  // 保证最少 1.6s 让用户看到品牌
  const elapsed = Date.now() - start
  if (elapsed < 1600) {
    await new Promise(r => setTimeout(r, 1600 - elapsed))
  }
  router.replace(store.currentUserId ? '/home' : '/select')
})
</script>

<template>
  <div class="kz-loading">
    <!-- 装饰光斑 -->
    <div class="kz-glow kz-glow-1"></div>
    <div class="kz-glow kz-glow-2"></div>

    <!-- Logo 中心 -->
    <div class="kz-center">
      <div class="kz-logo-wrap">
        <img src="/assets/kizuna-logo.png" alt="绊 KIZUNA" class="kz-logo-img" />
      </div>

      <p class="kz-slogan kz-fade-in" style="animation-delay: 1.0s">同好即相遇</p>
    </div>

    <!-- 底部加载条 -->
    <div class="kz-loading-bar">
      <div class="kz-loading-bar-fill"></div>
    </div>
    <p class="kz-tip kz-fade-in" style="animation-delay: 1.2s">连接中...</p>
  </div>
</template>

<style scoped>
.kz-loading {
  min-height: 100vh;
  background: var(--kizuna-grad-brand);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-family: var(--kizuna-font-family);
}

/* 装饰光斑 */
.kz-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.5;
  pointer-events: none;
}

.kz-glow-1 {
  top: -10%;
  left: -10%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, #fff5dc 0%, transparent 70%);
  animation: kz-float 4s ease-in-out infinite;
}

.kz-glow-2 {
  bottom: -15%;
  right: -15%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, #f0ede5 0%, transparent 70%);
  animation: kz-float 5s ease-in-out infinite reverse;
}

.kz-center {
  text-align: center;
  position: relative;
  z-index: 1;
}

.kz-logo-wrap {
  width: 160px;
  height: 160px;
  margin: 0 auto 24px;
  animation: kz-pop 0.8s var(--kizuna-ease) both;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 28px;
  overflow: hidden;
  background: #ffffff;
}

.kz-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.kz-slogan {
  font-size: 15px;
  color: var(--kizuna-text-soft);
  margin: 0;
  font-weight: 400;
  letter-spacing: 0.05em;
}

/* 加载条 */
.kz-loading-bar {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  width: 160px;
  height: 3px;
  background: rgba(43, 42, 38, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.kz-loading-bar-fill {
  height: 100%;
  background: var(--kizuna-primary);
  border-radius: 999px;
  animation: kz-fill 1.4s var(--kizuna-ease-out) forwards;
}

@keyframes kz-fill {
  0%   { width: 0; }
  100% { width: 100%; }
}

.kz-tip {
  position: absolute;
  bottom: 50px;
  font-size: 11px;
  color: var(--kizuna-text-faint);
  margin: 0;
  letter-spacing: 0.1em;
}
</style>