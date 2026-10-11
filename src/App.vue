<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKizunaStore } from './stores/kizuna'
import { useAuthStore } from './stores/auth'
import TabBar from './components/TabBar.vue'
import AlertView from './components/AlertView.vue'

const route = useRoute()
const router = useRouter()
const store = useKizunaStore()
const auth = useAuthStore()

const NEED_AUTH = ['/home', '/home/matches', '/profile', '/pair', '/add', '/messages', '/editor', '/intent', '/settings', '/preview']

onMounted(async () => {
  try {
    await auth.init()
  } catch (e) {
    console.error('[App] auth.init failed:', e)
  }
  try {
    if (auth.authUid) {
      await store.syncCurrentUserFromAuth(auth.authUid)
    }
  } catch (e) {
    console.error('[App] syncCurrentUser failed:', e)
  }
  try {
    await store.init()
  } catch (e) {
    console.error('[App] store.init failed:', e)
  }
  try {
    if (store.hasUser) {
      store.subscribeRealtime()
    }
  } catch (e) {
    console.error('[App] subscribeRealtime failed:', e)
  }
})

watch(() => auth.authUid, async (uid) => {
  try {
    if (uid) {
      await store.syncCurrentUserFromAuth(uid)
      store.subscribeRealtime()
    } else {
      store.unsubscribeRealtime()
      store.setCurrentUser(null)
    }
  } catch (e) {
    console.error('[App] auth watch failed:', e)
  }
})

watch(
  () => [route.path, auth.isLoggedIn],
  ([path, isLoggedIn]) => {
    if (!isLoggedIn && NEED_AUTH.includes(path as string)) {
      router.replace('/')
    }
  },
  { immediate: true }
)

const showTabBar = computed(() => !route.meta.hideTabBar)
</script>

<template>
  <div class="app-root">
    <router-view v-slot="{ Component, route: r }">
      <component :is="Component" :key="r.path" />
    </router-view>
    <TabBar v-if="showTabBar" />
    <AlertView />
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  background: var(--kizuna-bg);
  font-family: var(--kizuna-font-family);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  color: var(--kizuna-text);
}

* { box-sizing: border-box; }

.app-root {
  min-height: 100vh;
  background: var(--kizuna-bg);
}

</style>
