<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import ZhongguCard from '../components/ZhongguCard.vue'
import ZhongguCardCompact from '../components/ZhongguCardCompact.vue'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const route = useRoute()
const store = useKizunaStore()

// 2026-08-21 v0.9.21：5 个 tab（关注/推荐/服饰/道具/谷子）
type ZhongguTab = 'follow' | 'recommend' | 'clothing' | 'prop' | 'figure'

const activeTab = ref<ZhongguTab>('recommend')
const searchKeyword = ref('')

// 5 个 tab 配置
const tabs: { value: ZhongguTab; label: string }[] = [
  { value: 'follow', label: '关注' },
  { value: 'recommend', label: '推荐' },
  { value: 'clothing', label: '服饰' },
  { value: 'prop', label: '道具' },
  { value: 'figure', label: '谷子' },
]

// 2026-10-03：支持 ?tab=follow 直达（详情页「编辑挂出」入口）
// 注意：必须在 tabs 声明之后，否则 TDZ 抛错
const initialTab = String(route.query.tab || '')
if (tabs.some(t => t.value === initialTab)) {
  activeTab.value = initialTab as ZhongguTab
}

// 从其他页面带 query 跳进来时，router-view 的 key 是 path，query 变化不会重建组件，
// 所以必须 watch query 同步 tab（如发布成功后跳 /zhonggu?tab=follow）
watch(
  () => route.query.tab,
  (val) => {
    const t = String(val || '')
    if (tabs.some(x => x.value === t)) {
      activeTab.value = t as ZhongguTab
    }
  },
)

// 推荐 tab：广场所有 active listings（排除自己挂出的）
const recommendListings = computed(() => {
  let list = store.publicListings
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(l =>
      l.title.toLowerCase().includes(kw) ||
      l.ip_tag.toLowerCase().includes(kw) ||
      (l.description || '').toLowerCase().includes(kw)
    )
  }
  return list
})

// 关注 tab：我关注的人的 listings
const followListings = computed(() => {
  const ids = store.myFollowingIds
  if (ids.length === 0) return []
  let list = store.activeListings.filter(l => ids.includes(l.owner_id))
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(l =>
      l.title.toLowerCase().includes(kw) ||
      l.ip_tag.toLowerCase().includes(kw)
    )
  }
  return list
})

// 按 tag 筛选（服饰/道具/谷子）
function filterByTag(tab: ZhongguTab) {
  const tagMap: Record<string, string[]> = {
    clothing: ['服饰', '衣服', '鞋子', '包', '帽子', '围巾'],
    prop: ['道具', '武器', '武器模型', '道具模型', '周边道具'],
    figure: ['谷子', '手办', '立牌', '徽章', '亚克力', '卡牌', '贴纸', '海报'],
  }
  const keywords = tagMap[tab] || []
  let list = store.publicListings.filter(l => {
    // 优先看 listing.tags，其次看 ip_tag
    const allTags = [...(l.tags || []), l.ip_tag].join(' ')
    return keywords.some(k => allTags.includes(k))
  })
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(l =>
      l.title.toLowerCase().includes(kw) ||
      l.ip_tag.toLowerCase().includes(kw)
    )
  }
  return list
}

const clothingListings = computed(() => filterByTag('clothing'))
const propListings = computed(() => filterByTag('prop'))
const figureListings = computed(() => filterByTag('figure'))

// 当前 tab 的列表
const currentListings = computed(() => {
  switch (activeTab.value) {
    case 'follow': return followListings.value
    case 'recommend': return recommendListings.value
    case 'clothing': return clothingListings.value
    case 'prop': return propListings.value
    case 'figure': return figureListings.value
  }
})

// 我的挂出（仅「关注」tab 内展示，含下架/重新上架管理操作）
// 2026-10-03：自己的挂出只在关注 tab 可见，其他任何位置都不可见
const myActiveListings = computed(() => {
  let list = store.myListings.filter(l => l.status === 'active')
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(l =>
      l.title.toLowerCase().includes(kw) ||
      l.ip_tag.toLowerCase().includes(kw)
    )
  }
  return list
})

async function onArchiveMine(id: string) {
  await store.archiveListing(id)
}

async function onRestoreMine(id: string) {
  await store.restoreListing(id)
}

function onSearch() {
  // 已经在 computed 里即时过滤
}

function clearSearch() {
  searchKeyword.value = ''
}

function onListingClick(id: string) {
  router.push(`/zhonggu/${id}`)
}

// 我关注的：数量提示
const followingCount = computed(() => store.followingCount)

onMounted(async () => {
  if (store.listings.length === 0) {
    await store.fetchListings()
  }
  if (store.users.length === 0) {
    await store.fetchUsers()
  }
  // 关注数据加载（mock fallback 也 OK）
  if (store.follows.length === 0) {
    try {
      await store.fetchFollows()
    } catch (e) {
      // ignore — fallback to mock
    }
  }
})
</script>

<template>
  <div class="zg-page">
    <!-- 顶部搜索栏 -->
    <div class="zg-search-bar">
      <button class="zg-back-btn" aria-label="返回">
        <span>←</span>
      </button>
      <div class="zg-search-input-wrap">
        <input
          v-model="searchKeyword"
          @input="onSearch"
          type="text"
          placeholder="搜索商品、IP、角色..."
          class="zg-search-input"
        />
        <button v-if="searchKeyword" @click="clearSearch" class="zg-search-clear" aria-label="清空">×</button>
      </div>
      <button class="zg-search-icon" aria-label="搜索">
        <span></span>
      </button>
      <button class="zg-camera-btn" aria-label="拍照发布">
        <span></span>
      </button>
    </div>

    <!-- tab 行 -->
    <div class="zg-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="activeTab = tab.value"
        class="zg-tab"
        :class="{ 'zg-tab-active': activeTab === tab.value }"
      >
        {{ tab.label }}
        <span v-if="tab.value === 'follow' && followingCount > 0" class="zg-tab-badge">
          {{ followingCount }}
        </span>
      </button>
    </div>

    <!-- 关注 tab 空态（既无关注也无挂出） -->
    <div
      v-if="activeTab === 'follow' && followingCount === 0 && myActiveListings.length === 0"
      class="zg-empty-wrap"
    >
      <EmptyState
        emoji=""
        title="暂无关注"
        desc="去漫展详情页或其他用户主页关注 ta，关注后 ta 发布的谷子第一时间出现在这里"
        variant="compact"
      />
    </div>

    <!-- 我的挂出（仅关注 tab 显示，含管理操作） -->
    <div v-if="myActiveListings.length > 0 && activeTab === 'follow'" class="zg-mine-section">
      <div class="zg-mine-header">
        <span class="zg-mine-title">我的挂出（{{ myActiveListings.length }}）</span>
      </div>
      <div class="zg-mine-list">
        <ZhongguCard
          v-for="listing in myActiveListings"
          :key="listing.id"
          :listing="listing"
          :owner="store.getUserById(listing.owner_id)"
          :show-actions="true"
          :on-archive="() => onArchiveMine(listing.id)"
          :on-restore="() => onRestoreMine(listing.id)"
          :on-delete="() => {}"
          @click="router.push(`/zhonggu/${listing.id}`)"
        />
      </div>
    </div>

    <!-- 双列网格 -->
    <div v-if="currentListings.length > 0" class="zg-grid">
      <ZhongguCardCompact
        v-for="listing in currentListings"
        :key="listing.id"
        :listing="listing"
        :owner="store.getUserById(listing.owner_id)"
        @click="onListingClick"
      />
    </div>

    <!-- 空态 -->
    <div v-else-if="activeTab !== 'follow'" class="zg-empty-wrap">
      <EmptyState
        emoji=""
        :title="searchKeyword ? '没找到匹配的商品' : `${tabs.find(t => t.value === activeTab)?.label || '列表'}为空`"
        :desc="searchKeyword ? '试试换个关键词' : '稍后再来看看'"
        variant="compact"
      />
    </div>

    <!-- 关注 tab 有搜索时的空态 -->
    <div v-else-if="searchKeyword" class="zg-empty-wrap">
      <EmptyState
        emoji=""
        title="没找到匹配的商品"
        desc="试试换个关键词"
        variant="compact"
      />
    </div>

    <!-- 关注 tab：关注了但对方还没挂出 -->
    <div v-else-if="activeTab === 'follow' && followingCount > 0" class="zg-empty-wrap">
      <EmptyState
        emoji=""
        title="关注的人还没挂出"
        desc="先去推荐里逛逛其他用户的挂出吧"
        variant="compact"
      />
    </div>

    <div class="zg-bottom-spacer"></div>
  </div>
</template>

<style scoped>
.zg-page {
  min-height: 100vh;
  background: var(--kizuna-bg);
  padding-bottom: 80px;
}

/* 搜索栏 */
.zg-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--kizuna-bg-elevated);
  border-bottom: 1px solid var(--kizuna-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.zg-back-btn,
.zg-search-icon,
.zg-camera-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  font-size: 18px;
  color: var(--kizuna-text);
  cursor: pointer;
  border-radius: 8px;
  flex-shrink: 0;
}

.zg-back-btn:hover,
.zg-search-icon:hover,
.zg-camera-btn:hover {
  background: var(--kizuna-bg);
}

.zg-search-input-wrap {
  flex: 1;
  position: relative;
  background: var(--kizuna-bg);
  border-radius: 999px;
  height: 36px;
  display: flex;
  align-items: center;
}

.zg-search-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 32px 0 14px;
  font-size: 14px;
  color: var(--kizuna-text);
  outline: none;
}

.zg-search-input::placeholder {
  color: var(--kizuna-text-faint);
}

.zg-search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--kizuna-border);
  color: var(--kizuna-text-soft);
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zg-search-clear:hover {
  background: var(--kizuna-text-faint);
  color: white;
}

/* tab 行 */
.zg-tabs {
  display: flex;
  padding: 8px 14px 0;
  background: var(--kizuna-bg-elevated);
  border-bottom: 1px solid var(--kizuna-border);
  position: sticky;
  top: 60px;
  z-index: 9;
  overflow-x: auto;
  scrollbar-width: none;
}

.zg-tabs::-webkit-scrollbar {
  display: none;
}

.zg-tab {
  position: relative;
  flex-shrink: 0;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--kizuna-text-soft);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.18s;
  white-space: nowrap;
}

.zg-tab-active {
  color: var(--kizuna-text);
  font-weight: 700;
}

.zg-tab-active::after {
  content: '';
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 3px;
  border-radius: 999px;
  background: var(--kizuna-text);
}

.zg-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 4px;
  font-size: 10px;
  font-weight: 700;
  background: var(--kizuna-accent);
  color: white;
  border-radius: 999px;
}

/* 我的挂出快览 */
.zg-mine-section {
  background: var(--kizuna-bg-elevated);
  margin: 12px 14px;
  padding: 12px;
  border-radius: var(--kizuna-radius-md);
  border: 1px solid var(--kizuna-border);
}

.zg-mine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.zg-mine-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--kizuna-text);
}

.zg-mine-more {
  font-size: 12px;
  color: var(--kizuna-text-soft);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.zg-mine-more:hover {
  background: var(--kizuna-bg);
}

.zg-mine-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 双列网格 */
.zg-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 12px 14px;
}

/* 空态 */
.zg-empty-wrap {
  padding: 60px 14px;
}

/* 底部留空 */
.zg-bottom-spacer {
  height: 60px;
}
</style>