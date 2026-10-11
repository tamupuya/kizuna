<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { findMatches } from '../lib/matching'
import { findMatchesV2, recommendByScene } from '../lib/matching-v2'

const router = useRouter()
const store = useKizunaStore()

const minScore = 5
const topN = 20

onMounted(async () => {
  if (store.users.length === 0) await store.init()
})

/** expo 标题查询器（用于场景化 reasons） */
const expoLookup = computed(() => ({
  getExpoTitle: (id: string) => store.expos.find(e => e.id === id)?.title,
}))

const matches = computed(() => {
  const me = store.currentUser as any
  if (!me) return []
  return findMatchesV2(me, store.users as any[], expoLookup.value, [], topN)
    .filter(m => m.score.total >= minScore)
})

/** v2 分池 */
const buckets = computed(() => {
  const me = store.currentUser as any
  if (!me) return null
  return recommendByScene(me, store.users as any[], expoLookup.value, { perBucket: 5 })
})

function goProfile(userId: string) {
  router.push(`/matches/${userId}`)
}
</script>

<template>
  <div class="matches-page" v-if="store.currentUser">
    <div class="top-bar">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="page-title">匹配的同好</h1>
      <div style="width: 24px"></div>
    </div>

    <div class="matches-shell">
      <p class="hero-sub">
        基于兴趣重合度、意图互补度和地区，从 {{ store.users.length - 1 }} 位同好中挑出与你最像的
      </p>

      <!-- v2 分池推荐 -->
      <div v-if="buckets && (buckets.onSite.length + buckets.upcoming.length + buckets.city.length > 0)" class="scene-buckets">
        <section v-if="buckets.onSite.length > 0" class="bucket bucket-onsite">
          <header class="bucket-head">
            <h3 class="bucket-title">今天同在</h3>
            <span class="bucket-count">{{ buckets.onSite.length }}</span>
          </header>
          <div class="bucket-list">
            <button
              v-for="m in buckets.onSite"
              :key="m.user.id"
              class="bucket-pill"
              @click="goProfile(m.user.id)"
            >
              <img :src="m.user.avatar_url" :alt="m.user.cn" class="bucket-avatar" />
              <div class="bucket-info">
                <div class="bucket-name">{{ m.user.cn }}</div>
                <div class="bucket-reason">{{ m.score.reasons[0] || '同一场漫展' }}</div>
              </div>
              <div class="bucket-score">{{ m.score.total }}</div>
            </button>
          </div>
        </section>

        <section v-if="buckets.upcoming.length > 0" class="bucket bucket-upcoming">
          <header class="bucket-head">
            <h3 class="bucket-title">同想去的展</h3>
            <span class="bucket-count">{{ buckets.upcoming.length }}</span>
          </header>
          <div class="bucket-list">
            <button
              v-for="m in buckets.upcoming"
              :key="m.user.id"
              class="bucket-pill"
              @click="goProfile(m.user.id)"
            >
              <img :src="m.user.avatar_url" :alt="m.user.cn" class="bucket-avatar" />
              <div class="bucket-info">
                <div class="bucket-name">{{ m.user.cn }}</div>
                <div class="bucket-reason">{{ m.score.reasons[0] || '都在观望' }}</div>
              </div>
              <div class="bucket-score">{{ m.score.total }}</div>
            </button>
          </div>
        </section>

        <section v-if="buckets.city.length > 0" class="bucket bucket-city">
          <header class="bucket-head">
            <h3 class="bucket-title">同城</h3>
            <span class="bucket-count">{{ buckets.city.length }}</span>
          </header>
          <div class="bucket-list">
            <button
              v-for="m in buckets.city"
              :key="m.user.id"
              class="bucket-pill"
              @click="goProfile(m.user.id)"
            >
              <img :src="m.user.avatar_url" :alt="m.user.cn" class="bucket-avatar" />
              <div class="bucket-info">
                <div class="bucket-name">{{ m.user.cn }}</div>
                <div class="bucket-reason">{{ m.score.reasons[0] || '同城' }}</div>
              </div>
              <div class="bucket-score">{{ m.score.total }}</div>
            </button>
          </div>
        </section>
      </div>

      <div v-if="matches.length === 0" class="empty">
        <div class="empty-title">还没找到匹配的同好</div>
        <p class="empty-desc">或许还有一些未完成的任务</p>
        <button @click="router.push('/editor')" class="empty-cta">去填人设卡</button>
      </div>

      <div v-else class="match-list">
        <article
          v-for="m in matches"
          :key="m.user.id"
          class="match-card"
          @click="goProfile(m.user.id)"
        >
          <div class="match-head">
            <img :src="m.user.avatar_url" :alt="m.user.cn" class="match-avatar" />
            <div class="match-info">
              <div class="match-name">{{ m.user.cn }}</div>
              <div class="match-meta">
                <span class="match-gender">
                  {{
                    m.user.gender === 'male' ? '男' :
                    m.user.gender === 'female' ? '女' : '保密'
                  }}
                </span>
                <span v-if="m.user.activity_area" class="match-area">· {{ m.user.activity_area }}</span>
              </div>
              <div v-if="m.user.identity_tags?.length" class="match-tags">
                <span v-for="t in m.user.identity_tags.slice(0, 2)" :key="t" class="match-tag">{{ t }}</span>
              </div>
            </div>
            <div class="match-score">
              <div class="score-num">{{ m.score.total }}</div>
              <div class="score-label">匹配度</div>
            </div>
          </div>

          <p v-if="m.user.bio" class="match-bio">"{{ m.user.bio }}"</p>

          <div v-if="m.score.reasons.length > 0" class="match-reasons">
            <div v-for="(r, idx) in m.score.reasons" :key="idx" class="reason-pill">
              {{ r }}
            </div>
          </div>

          <div class="match-bar">
            <div class="bar-row">
              <span class="bar-label">场景</span>
              <div class="bar-track">
                <div class="bar-fill bar-scene" :style="{ width: `${(m.score.scene / 30) * 100}%` }"></div>
              </div>
              <span class="bar-num">{{ m.score.scene }}/30</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">兴趣</span>
              <div class="bar-track">
                <div class="bar-fill bar-interest" :style="{ width: `${(m.score.interest / 25) * 100}%` }"></div>
              </div>
              <span class="bar-num">{{ m.score.interest }}/25</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">意图</span>
              <div class="bar-track">
                <div class="bar-fill bar-intent" :style="{ width: `${(m.score.intent / 20) * 100}%` }"></div>
              </div>
              <span class="bar-num">{{ m.score.intent }}/20</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">身份</span>
              <div class="bar-track">
                <div class="bar-fill bar-identity" :style="{ width: `${(m.score.identity / 15) * 100}%` }"></div>
              </div>
              <span class="bar-num">{{ m.score.identity }}/15</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">地区</span>
              <div class="bar-track">
                <div class="bar-fill bar-area" :style="{ width: `${((m.score.area + m.score.mbti) / 10) * 100}%` }"></div>
              </div>
              <span class="bar-num">{{ m.score.area + m.score.mbti }}/10</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.matches-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 480px;
  margin: 0 auto 14px;
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

.matches-shell {
  max-width: 480px;
  margin: 0 auto;
}

.hero-sub {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 14px;
  line-height: 1.5;
  padding: 0 4px;
}

/* ===== v2 分池 ===== */
.scene-buckets {
  margin-bottom: 20px;
}

.bucket {
  margin-bottom: 16px;
  background: #ffffff;
  border-radius: 14px;
  padding: 14px 14px 12px;
  border: 1px solid #f0ede5;
  box-shadow: 0 2px 8px rgba(43, 42, 38, 0.04);
}

.bucket-onsite {
  background: linear-gradient(135deg, #fff5dc 0%, #ffffff 60%);
  border-color: #e6c97a;
}

.bucket-upcoming {
  background: linear-gradient(135deg, #fce8e6 0%, #ffffff 60%);
  border-color: #f3b9b3;
}

.bucket-city {
  background: linear-gradient(135deg, #e6f2eb 0%, #ffffff 60%);
  border-color: #a8d4ba;
}

.bucket-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.bucket-icon {
  font-size: 18px;
}

.bucket-title {
  font-size: 14px;
  font-weight: 700;
  color: #2b2a26;
  margin: 0;
  flex: 1;
}

.bucket-count {
  font-size: 12px;
  color: #8c8780;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.bucket-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bucket-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: left;
  font-family: inherit;
  width: 100%;
}

.bucket-pill:hover {
  background: #ffffff;
  border-color: #d8d3c8;
  transform: translateX(2px);
}

.bucket-pill:active {
  transform: scale(0.98);
}

.bucket-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #f5f1e8;
}

.bucket-info {
  flex: 1;
  min-width: 0;
}

.bucket-name {
  font-size: 13px;
  font-weight: 600;
  color: #2b2a26;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bucket-reason {
  font-size: 11px;
  color: #8c8780;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bucket-score {
  font-size: 13px;
  font-weight: 700;
  color: #d97706;
  flex-shrink: 0;
  background: #fff5dc;
  padding: 3px 8px;
  border-radius: 8px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  background: #ffffff;
  border-radius: 14px;
  border: 1px dashed #e8e6e1;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
  color: #a8a39a;
  margin-bottom: 14px;
}

.empty-cta {
  padding: 10px 20px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.match-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #f0ede5;
  cursor: pointer;
  transition: all 0.18s ease;
}

.match-card:hover {
  border-color: #b8ad95;
  transform: translateY(-1px);
}

.match-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.match-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.match-info {
  flex: 1;
  min-width: 0;
}

.match-name {
  font-size: 16px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 2px;
}

.match-meta {
  font-size: 12px;
  color: #5c5953;
  margin-bottom: 4px;
}

.match-gender {
  font-weight: 500;
}

.match-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.match-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: #fff5dc;
  color: #5c4d2e;
  border-radius: 8px;
}

.match-score {
  flex-shrink: 0;
  text-align: center;
}

.score-num {
  font-size: 28px;
  font-weight: 700;
  color: #2e7d32;
  letter-spacing: -0.04em;
  line-height: 1;
}

.score-label {
  font-size: 10px;
  color: #a8a39a;
  margin-top: 2px;
}

.match-bio {
  font-size: 12px;
  color: #5c5953;
  margin: 10px 0 8px;
  font-style: italic;
  line-height: 1.5;
}

.match-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.reason-pill {
  font-size: 11px;
  padding: 3px 9px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 10px;
}

.match-bar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 10px;
  border-top: 1px solid #f5f3ee;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-label {
  font-size: 10px;
  color: #a8a39a;
  width: 28px;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 4px;
  background: #fafaf8;
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s cubic-bezier(.34,1.56,.64,1);
}

.bar-scene { background: linear-gradient(90deg, #d97706 0%, #f59e0b 100%); }
.bar-interest { background: #ec4899; }
.bar-intent { background: #f59e0b; }
.bar-identity { background: #14b8a6; }
.bar-area { background: #6366f1; }

.bar-num {
  font-size: 10px;
  color: #a8a39a;
  width: 32px;
  text-align: right;
  flex-shrink: 0;
}
</style>