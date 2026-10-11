<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { supabase } from '../lib/supabase'
import type { Dispute } from '../lib/mockData'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useKizunaStore()
const rawListingId = route.params.listingId as string
const listingId = computed(() => {
  if (!rawListingId || typeof rawListingId !== 'string') return ''
  return rawListingId
})


const dispute = ref<Dispute | null>(null)
const listing = computed(() => store.listings.find(l => l.id === listingId))
const loading = ref(true)

onMounted(async () => {
  if (store.listings.length === 0) await store.fetchListings()
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('listing_id', listingId)
    .order('opened_at', { ascending: false })
    .limit(1)
    .single()
  if (!error && data) {
    dispute.value = data as Dispute
  }
  loading.value = false
})

const reasonText = computed(() => {
  if (!dispute.value) return ''
  const map: Record<string, string> = {
    not_received: '未收到货',
    mismatch: '描述不符',
    defect: '质量问题',
    other: '其他',
  }
  return map[dispute.value.reason] || dispute.value.reason
})

const statusText = computed(() => {
  if (!dispute.value) return ''
  const map: Record<string, string> = {
    open: '处理中',
    resolved_buyer: '已裁决（买家胜）',
    resolved_seller: '已裁决（卖家胜）',
    resolved_split: '',
  }
  return map[dispute.value.status] || dispute.value.status
})

const statusColor = computed(() => {
  if (!dispute.value) return 'bg-gray-100 text-gray-600'
  if (dispute.value.status === 'open') return 'bg-orange-100 text-orange-700'
  return 'bg-green-100 text-green-700'
})
</script>

<template>
  <div class="dp-page">
    <div class="top-bar">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="page-title">申诉详情</h1>
      <div style="width: 24px"></div>
    </div>

    <div class="dp-shell">
      <div v-if="loading" class="dp-loading">加载中...</div>

      <div v-else-if="!dispute">
        <EmptyState
          emoji=""
          title="没有找到这条申诉"
          desc=""
          primary-text="返回"
          :primary-action="() => router.back()"
          variant="compact"
        />
      </div>

      <div v-else class="dp-content">
        <div class="dp-banner" :class="statusColor">
          {{ statusText }}
        </div>

        <section class="dp-card">
          <h3 class="dp-section-label">挂出品</h3>
          <p v-if="listing" class="dp-listing-title">{{ listing.title }}</p>
        </section>

        <section class="dp-card">
          <h3 class="dp-section-label">申诉原因</h3>
          <p class="dp-text">{{ reasonText }}</p>
          <p v-if="dispute.description" class="dp-desc">{{ dispute.description }}</p>
        </section>

        <section class="dp-card">
          <h3 class="dp-section-label">提交时间</h3>
          <p class="dp-text">{{ new Date(dispute.opened_at).toLocaleString('zh-CN') }}</p>
        </section>

        <section v-if="dispute.resolved_at" class="dp-card">
          <h3 class="dp-section-label">裁决</h3>
          <p class="dp-text">{{ new Date(dispute.resolved_at).toLocaleString('zh-CN') }}</p>
          <p v-if="dispute.resolution_note" class="dp-desc">{{ dispute.resolution_note }}</p>
        </section>

        <section v-if="dispute.evidence?.length" class="dp-card">
          <h3 class="dp-section-label">证据（截图）</h3>
          <div class="dp-evidence-grid">
            <img
              v-for="(e, i) in dispute.evidence"
              :key="i"
              :src="e.url"
              :alt="`证据${i + 1}`"
              class="dp-evidence-img"
            />
          </div>
        </section>

        <p class="dp-footer-hint">
          平台不参与资金托管，裁决仅作为信用记录公示
        </p>

        <button @click="router.back()" class="dp-submit">返回详情</button>
      </div>

      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.dp-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 480px;
  margin: 0 auto 16px;
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

.dp-shell {
  max-width: 480px;
  margin: 0 auto;
}

.dp-loading {
  text-align: center;
  padding: 40px 20px;
  color: #a8a39a;
}

.dp-banner {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 12px;
}

.dp-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
  border: 1px solid #f0ede5;
}

.dp-section-label {
  font-size: 12px;
  font-weight: 700;
  color: #5c5953;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.dp-text {
  font-size: 14px;
  color: #2b2a26;
  font-weight: 500;
}

.dp-desc {
  font-size: 13px;
  color: #5c5953;
  margin-top: 6px;
  line-height: 1.6;
}

.dp-listing-title {
  font-size: 14px;
  color: #2b2a26;
  font-weight: 500;
}

.dp-evidence-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.dp-evidence-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e8e6e1;
}

.dp-footer-hint {
  font-size: 11px;
  color: #a8a39a;
  text-align: center;
  margin: 16px 0 12px;
}

.dp-submit {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.safe-bottom {
  height: 24px;
}
</style>