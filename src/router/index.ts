import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // Entry / no-tab pages
    { path: '/', component: () => import('../views/SelectView.vue') },
    { path: '/loading', component: () => import('../views/LoadingView.vue') },
    { path: '/select', component: () => import('../views/SelectView.vue') },

    // Tab pages (show TabBar) - 5 Tabs: 首页 / 中谷店 / + / 消息 / 我的
    { path: '/home', component: () => import('../views/HomeView.vue') },
    { path: '/zhonggu', component: () => import('../views/ZhongguView.vue') },
    { path: '/add', component: () => import('../views/AddView.vue') },
    { path: '/messages', component: () => import('../views/MessagesView.vue') },
    { path: '/profile', component: () => import('../views/ProfileView.vue') },

    // Hide TabBar - quickTab 跳转目标（p0: quickTab 不跳页，改为 v-show + scrollIntoView）
    // v0.9.20 quickTab 改为不跳新页面，路由已废弃
    // v0.10（2026-10-03）ExposView / RadarRoomsView / RadarView 已移入 _legacy/（零引用，用户确认清掉）
    // 漫展 section 与同窗会 section 现已内联在 HomeView
    { path: '/home/matches', component: () => import('../views/MatchesView.vue'), meta: { hideTabBar: true } },

    // Hide TabBar - 旧路由保留（兼容）
    // v0.10（2026-10-03）：双人配对（推窗 → 配对 → 开房）
    { path: '/pair', component: () => import('../views/PairView.vue'), meta: { hideTabBar: true } },
    { path: '/radar/launch', component: () => import('../views/RadarLaunchView.vue'), meta: { hideTabBar: true } },
    { path: '/radar/room/:id', component: () => import('../views/RadarRoomView.vue'), meta: { hideTabBar: true } },
    { path: '/radar/:expoId', component: () => import('../views/ExpoDetailView.vue'), meta: { hideTabBar: true } },
    { path: '/expo/:id', component: () => import('../views/ExpoDetailView.vue'), meta: { hideTabBar: true } },
    { path: '/matches/:userId', component: () => import('../views/MatchDetailView.vue'), meta: { hideTabBar: true } },
    { path: '/zhonggu/:listingId', component: () => import('../views/ZhongguDetailView.vue'), meta: { hideTabBar: true } },
    { path: '/zhonggu/:listingId/dispute', component: () => import('../views/DisputeView.vue'), meta: { hideTabBar: true } },
    { path: '/zhonggu/new', component: () => import('../views/ZhongguFormView.vue'), meta: { hideTabBar: true } },
    { path: '/editor', component: () => import('../views/EditorView.vue'), meta: { hideTabBar: true } },
    { path: '/editor/oc', component: () => import('../views/OcEditorView.vue'), meta: { hideTabBar: true } },
    { path: '/merchant', component: () => import('../views/MerchantConsoleView.vue'), meta: { hideTabBar: true } },
    { path: '/login', component: () => import('../views/LoginView.vue'), meta: { hideTabBar: true } },
    { path: '/register', component: () => import('../views/RegisterView.vue'), meta: { hideTabBar: true } },
    { path: '/conversation/:requestId', component: () => import('../views/ConversationView.vue'), meta: { hideTabBar: true } },
    { path: '/intent', component: () => import('../views/IntentView.vue'), meta: { hideTabBar: true } },
    { path: '/settings', component: () => import('../views/SettingsView.vue'), meta: { hideTabBar: true } },
    { path: '/preview', component: () => import('../views/PreviewView.vue'), meta: { hideTabBar: true } },

    // Admin 路由已移除（P0 不需要后台）
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
