<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { useAuthStore } from '../stores/auth'
import { useAlertStore } from '../stores/alert'

const router = useRouter()
const store = useKizunaStore()
const auth = useAuthStore()
const alert = useAlertStore()

interface MenuItem {
  icon: string
  label: string
  desc: string
  action: () => void
  color: string
}

const savingContact = ref(false)

const contact = ref({
  phone: '',
  wechat: '',
  qq: '',
  email: '',
})

// 初始化（只在第一次加载）
function initContact() {
  const u = store.currentUser
  if (u?.contact) {
    contact.value = {
      phone: u.contact.phone || '',
      wechat: u.contact.wechat || '',
      qq: u.contact.qq || '',
      email: u.contact.email || '',
    }
  }
}
initContact()

const menuItems: MenuItem[] = [
  {
    icon: '',
    label: '通用设置',
    desc: '主题、字号',
    color: '#f5f5f5',
    action: () => alert.info('通用设置', '即将上线'),
  },
  {
    icon: '',
    label: '联系方式授权',
    desc: '管理同好请求',
    color: '#e3f2fd',
    action: () => router.push('/messages'),
  },
  {
    icon: '',
    label: '退出当前身份',
    desc: '切换 / 创建另一个身份',
    color: '#fff5dc',
    action: async () => {
      if (await alert.confirm('确定退出当前身份吗？', '切换 / 创建另一个身份')) {
        store.signOut()
        router.push('/select')
      }
    },
  },
  {
    icon: '',
    label: '清除本地缓存',
    desc: '导出、清除 localStorage',
    color: '#fff5dc',
    action: async () => {
      if (await alert.confirm('确定清除本地缓存吗？', '导出、清除 localStorage', { danger: true })) {
        localStorage.clear()
        location.reload()
      }
    },
  },
  {
    icon: '',
    label: '关于绊',
    desc: 'v0.10.4',
    color: '#f3e5f5',
    action: () => alert.info('关于绊', 'P0 最小闭环：人设卡 + 同窗会 + 中谷店'),
  },
]

async function saveContact() {
  if (!store.currentUserId) return
  savingContact.value = true
  const ok = await store.updateContact(store.currentUserId, contact.value)
  savingContact.value = false
  if (ok) {
    alert.success('联系方式已更新', '互授权后对方可见')
  } else {
    alert.error('更新失败', store.error || '未知错误')
  }
}

async function logout() {
  if (!auth.isLoggedIn) return
  if (await alert.confirm('确定要登出吗？')) {
    await auth.signOut()
    alert.info('已登出', '本地登录态已清除')
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-shell">
      <div class="top-bar">
        <button @click="router.back()" class="back-btn">←</button>
        <h1 class="page-title">设置</h1>
        <div style="width: 24px"></div>
      </div>

      <!-- Profile quick info -->
      <div v-if="store.currentUser" class="quick-card">
        <img :src="store.currentUser.avatar_url" :alt="store.currentUser.cn" class="quick-avatar" />
        <div class="quick-info">
          <div class="quick-name">{{ store.currentUser.cn }}</div>
          <div class="quick-id">ID: {{ store.currentUser.id?.slice(0, 8) }}…</div>
        </div>
      </div>

      <!-- Contact edit -->
      <div v-if="store.currentUser" class="contact-card">
        <h3 class="card-title">
           我的联系方式
          <span class="card-title-note">互授权后对方可见</span>
        </h3>

        <div class="contact-row">
          <label class="contact-label">手机</label>
          <input v-model="contact.phone" class="contact-input" placeholder="手机号" maxlength="11" />
        </div>
        <div class="contact-row">
          <label class="contact-label">微信</label>
          <input v-model="contact.wechat" class="contact-input" placeholder="微信" maxlength="30" />
        </div>
        <div class="contact-row">
          <label class="contact-label">QQ</label>
          <input v-model="contact.qq" class="contact-input" placeholder="QQ" maxlength="12" />
        </div>
        <div class="contact-row">
          <label class="contact-label">邮箱</label>
          <input v-model="contact.email" type="email" class="contact-input" placeholder="" maxlength="60" />
        </div>

        <button
          class="contact-save-btn"
          :disabled="savingContact"
          @click="saveContact"
        >
          {{ savingContact ? '保存中...' : '保存联系方式' }}
        </button>
      </div>

      <!-- Settings list -->
      <div class="settings-card">
        <button
          v-for="(item, idx) in menuItems"
          :key="item.label"
          class="settings-row"
          :class="{ 'row-divider': idx > 0 }"
          @click="item.action"
        >
          <div class="settings-content">
            <div class="settings-label">{{ item.label }}</div>
            <div class="settings-desc">{{ item.desc }}</div>
          </div>
          <span class="settings-arrow">›</span>
        </button>
      </div>

      <!-- Auth section -->
      <div class="auth-card">
        <div class="auth-row">
          <div>
            <div class="auth-label">登录邮箱</div>
            <div class="auth-value">{{ auth.user?.email || '未登录' }}</div>
          </div>
          <button v-if="auth.isLoggedIn" class="auth-action" @click="logout">登出</button>
          <button v-else class="auth-action primary" @click="router.push('/login')">登录</button>
        </div>
      </div>

      <p class="footer-note">绊 Kizuna · P0 最小闭环</p>

      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px;
}

.settings-shell {
  max-width: 480px;
  margin: 0 auto;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.back-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #2b2a26;
  cursor: pointer;
  padding: 4px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
}

/* Quick card */
.quick-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 14px;
  margin-bottom: 14px;
  border: 1px solid #f0ede5;
}

.quick-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.quick-info { flex: 1; min-width: 0; }
.quick-name { font-size: 15px; font-weight: 600; color: #2b2a26; margin-bottom: 2px; }
.quick-id { font-size: 11px; color: #a8a39a; font-family: monospace; }

/* Contact card */
.contact-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
  border: 1px solid #f0ede5;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.card-title-note {
  font-size: 11px;
  font-weight: 400;
  color: #a8a39a;
}

.contact-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.contact-row:last-of-type {
  margin-bottom: 14px;
}

.contact-label {
  width: 36px;
  font-size: 12px;
  color: #a8a39a;
  font-weight: 500;
  flex-shrink: 0;
}

.contact-input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 13px;
  color: #2b2a26;
  outline: none;
  transition: border-color 0.18s ease;
}

.contact-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.contact-save-btn {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.18s ease;
}

.contact-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.contact-save-btn:hover:not(:disabled) {
  background: #3a3528;
}

/* Settings list */
.settings-card {
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #f0ede5;
  margin-bottom: 14px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.18s ease;
}

.settings-row:hover {
  background: #fafaf8;
}

.settings-row.row-divider {
  border-top: 1px solid #f5f3ee;
}

.settings-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.settings-label {
  font-size: 15px;
  font-weight: 500;
  color: #2b2a26;
  margin-bottom: 2px;
}

.settings-desc {
  font-size: 12px;
  color: #a8a39a;
}

.settings-arrow {
  font-size: 18px;
  color: #c0bbb0;
}

/* Auth card */
.auth-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #f0ede5;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.auth-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.auth-label {
  font-size: 13px;
  color: #a8a39a;
  margin-bottom: 2px;
}

.auth-value {
  font-size: 14px;
  color: #2b2a26;
  font-family: monospace;
}

.auth-action {
  padding: 7px 14px;
  border-radius: 8px;
  background: transparent;
  color: #5c5953;
  border: 1px solid #e8e6e1;
  font-size: 13px;
  cursor: pointer;
}

.auth-action.primary {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

.footer-note {
  text-align: center;
  font-size: 11px;
  color: #c0bbb0;
  margin-top: 16px;
}

.safe-bottom {
  height: 24px;
}
</style>