<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null): void
}>()

const open = ref(false)

const GROUPS = [
  {
    name: '分析家',
    color: '#8b5cf6',
    bg: '#f3e8ff',
    types: [
      { code: 'INTJ', label: '建筑师', desc: '战略家，长远规划者' },
      { code: 'INTP', label: '逻辑学家', desc: '思想家，理论狂热者' },
      { code: 'ENTJ', label: '指挥官', desc: '果断的领导者' },
      { code: 'ENTP', label: '辩论家', desc: '机智的思想挑战者' },
    ],
  },
  {
    name: '外交家',
    color: '#10b981',
    bg: '#d1fae5',
    types: [
      { code: 'INFJ', label: '提倡者', desc: '理想主义的守护者' },
      { code: 'INFP', label: '调停者', desc: '柔软的诗人' },
      { code: 'ENFJ', label: '主人公', desc: '富有感染力的领导者' },
      { code: 'ENFP', label: '竞选者', desc: '热情的探索者' },
    ],
  },
  {
    name: '守望者',
    color: '#3b82f6',
    bg: '#dbeafe',
    types: [
      { code: 'ISTJ', label: '物流师', desc: '可靠的检查员' },
      { code: 'ISFJ', label: '守卫者', desc: '温暖的守护者' },
      { code: 'ESTJ', label: '总经理', desc: '高效执行者' },
      { code: 'ESFJ', label: '执政官', desc: '热心的协调者' },
    ],
  },
  {
    name: '探索者',
    color: '#f59e0b',
    bg: '#fed7aa',
    types: [
      { code: 'ISTP', label: '鉴赏家', desc: '冷静的实验者' },
      { code: 'ISFP', label: '探险家', desc: '温柔的艺术家' },
      { code: 'ESTP', label: '企业家', desc: '敏锐的实干者' },
      { code: 'ESFP', label: '表演者', desc: '活力四射的表演者' },
    ],
  },
]

const selected = computed(() => props.modelValue)

const selectedGroup = computed(() => {
  if (!selected.value) return null
  return GROUPS.find(g => g.types.some(t => t.code === selected.value)) || null
})

const selectedType = computed(() => {
  if (!selected.value) return null
  for (const g of GROUPS) {
    const t = g.types.find(t => t.code === selected.value)
    if (t) return { ...t, groupName: g.name, color: g.color, bg: g.bg }
  }
  return null
})

function pick(code: string) {
  // 选中后立即关闭弹窗
  emit('update:modelValue', selected.value === code ? null : code)
  open.value = false
}

function openSheet() {
  open.value = true
}

function clear() {
  emit('update:modelValue', null)
}
</script>

<template>
  <!-- 触发按钮：显示当前选中 / "点击选择" -->
  <button
    type="button"
    class="mbti-trigger"
    :class="{ 'mbti-trigger-active': selected }"
    :style="selectedType ? { background: selectedType.bg, borderColor: selectedType.color } : {}"
    @click="openSheet"
  >
    <template v-if="selectedType">
      <span class="mbti-trigger-code" :style="{ color: selectedType.color }">{{ selectedType.code }}</span>
      <span class="mbti-trigger-label" :style="{ color: selectedType.color }">{{ selectedType.label }}</span>
      <span class="mbti-trigger-clear" @click.stop="clear">×</span>
    </template>
    <template v-else>
      <span class="mbti-trigger-placeholder">+ 选择 MBTI</span>
    </template>
  </button>

  <!-- 弹窗 -->
  <Teleport to="body">
    <Transition name="mbti-sheet">
      <div v-if="open" class="mbti-mask" @click.self="open = false">
        <div class="mbti-sheet" role="dialog" aria-label="选择 MBTI">
          <div class="mbti-handle"></div>

          <header class="mbti-header">
            <h3 class="mbti-title">选择 MBTI</h3>
            <p class="mbti-sub">16 种人格 · 4 大族群</p>
          </header>

          <div class="mbti-body">
            <div v-for="g in GROUPS" :key="g.name" class="mbti-group">
              <div class="mbti-group-header">
                <span class="mbti-dot" :style="{ background: g.color }"></span>
                <span class="mbti-group-name" :style="{ color: g.color }">{{ g.name }}</span>
                <span class="mbti-group-count">{{ g.types.length }} 种</span>
              </div>
              <div class="mbti-grid">
                <button
                  v-for="t in g.types"
                  :key="t.code"
                  type="button"
                  class="mbti-pill-btn"
                  :class="{ 'mbti-pill-active': selected === t.code }"
                  :style="selected === t.code ? { background: g.color, borderColor: g.color, color: 'white' } : { borderColor: g.color, color: g.color }"
                  @click="pick(t.code)"
                >
                  <span class="mbti-pill-code">{{ t.code }}</span>
                  <span class="mbti-pill-label">{{ t.label }}</span>
                  <span class="mbti-pill-desc" :style="selected === t.code ? { color: 'rgba(255,255,255,0.85)' } : { color: '#8c8780' }">{{ t.desc }}</span>
                </button>
              </div>
            </div>
          </div>

          <footer class="mbti-footer">
            <button class="mbti-done" @click="open = false">完成</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== 触发按钮 ===== */
.mbti-trigger {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid #e0dcd4;
  background: #fafaf8;
  border-radius: 12px;
  font-size: 14px;
  color: #a8a39a;
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
  text-align: left;
}

.mbti-trigger:hover {
  border-color: #b8ad95;
  background: #ffffff;
  color: #5c5953;
}

.mbti-trigger-active {
  font-weight: 500;
}

.mbti-trigger-placeholder {
  flex: 1;
  color: #a8a39a;
}

.mbti-trigger-code {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.mbti-trigger-label {
  color: #2b2a26;
  font-weight: 600;
  flex: 1;
}

.mbti-trigger-group {
  font-size: 11px;
  opacity: 0.7;
}

.mbti-trigger-clear {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.08);
  color: #5c5953;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.mbti-trigger-clear:hover {
  background: rgba(0, 0, 0, 0.15);
}

/* ===== 弹窗 ===== */
.mbti-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
}

.mbti-sheet {
  background: #fffaf0;
  width: 100%;
  max-width: 480px;
  height: 85vh;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 24px rgba(43, 42, 38, 0.18);
  overflow: hidden;
}

.mbti-handle {
  width: 36px;
  height: 4px;
  background: #d4cfc4;
  border-radius: 2px;
  margin: 8px auto 4px;
  flex-shrink: 0;
}

.mbti-header {
  padding: 8px 18px 14px;
  border-bottom: 1px solid #f0ede5;
  flex-shrink: 0;
}

.mbti-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #2b2a26;
}

.mbti-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a8a39a;
}

.mbti-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 12px;
  -webkit-overflow-scrolling: touch;
}

.mbti-group {
  margin-bottom: 18px;
}

.mbti-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.mbti-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.mbti-group-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.mbti-group-count {
  font-size: 11px;
  color: #a8a39a;
  margin-left: auto;
}

.mbti-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.mbti-pill-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  background: white;
  border: 1.5px solid;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  font-family: inherit;
  text-align: center;
}

.mbti-pill-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.mbti-pill-active {
  font-weight: 600;
}

.mbti-pill-code {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.mbti-pill-label {
  font-size: 12px;
  margin-top: 2px;
  font-weight: 600;
}

.mbti-pill-desc {
  font-size: 10px;
  margin-top: 3px;
  line-height: 1.3;
}

.mbti-footer {
  padding: 12px 18px 24px;
  border-top: 1px solid #f0ede5;
  flex-shrink: 0;
  background: #fffaf0;
}

.mbti-done {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.18s ease;
  font-family: inherit;
}

.mbti-done:active {
  background: #3a3528;
}

/* ===== 过渡 ===== */
.mbti-sheet-enter-active,
.mbti-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.mbti-sheet-enter-active .mbti-sheet,
.mbti-sheet-leave-active .mbti-sheet {
  transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
}

.mbti-sheet-enter-from,
.mbti-sheet-leave-to {
  opacity: 0;
}

.mbti-sheet-enter-from .mbti-sheet,
.mbti-sheet-leave-to .mbti-sheet {
  transform: translateY(100%);
}
</style>
