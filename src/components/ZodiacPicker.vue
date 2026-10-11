<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null): void
}>()

const open = ref(false)

const ZODIACS = [
  { code: 'aquarius', name: '水瓶座', date: '1.20 - 2.18', color: '#06b6d4' },
  { code: 'pisces', name: '双鱼座', date: '2.19 - 3.20', color: '#a855f7' },
  { code: 'aries', name: '白羊座', date: '3.21 - 4.19', color: '#ef4444' },
  { code: 'taurus', name: '金牛座', date: '4.20 - 5.20', color: '#84cc16' },
  { code: 'gemini', name: '双子座', date: '5.21 - 6.21', color: '#f59e0b' },
  { code: 'cancer', name: '巨蟹座', date: '6.22 - 7.22', color: '#6b7280' },
  { code: 'leo', name: '狮子座', date: '7.23 - 8.22', color: '#f97316' },
  { code: 'virgo', name: '处女座', date: '8.23 - 9.22', color: '#0ea5e9' },
  { code: 'libra', name: '天秤座', date: '9.23 - 10.23', color: '#ec4899' },
  { code: 'scorpio', name: '天蝎座', date: '10.24 - 11.22', color: '#7c2d12' },
  { code: 'sagittarius', name: '射手座', date: '11.23 - 12.21', color: '#1e3a8a' },
  { code: 'capricorn', name: '摩羯座', date: '12.22 - 1.19', color: '#374151' },
]

const selected = computed(() => props.modelValue)

const selectedZodiac = computed(() => {
  if (!selected.value) return null
  return ZODIACS.find(z => z.code === selected.value) || null
})

function pick(code: string) {
  emit('update:modelValue', selected.value === code ? null : code)
  open.value = false
}

function clear() {
  emit('update:modelValue', null)
}
</script>

<template>
  <button
    type="button"
    class="zodiac-trigger"
    :class="{ 'zodiac-trigger-active': selected }"
    :style="selectedZodiac ? { background: selectedZodiac.color + '15', borderColor: selectedZodiac.color } : {}"
    @click="open = true"
  >
    <template v-if="selectedZodiac">
      <span class="zodiac-name" :style="{ color: selectedZodiac.color }">{{ selectedZodiac.name }}</span>
      <span class="zodiac-clear" @click.stop="clear">×</span>
    </template>
    <template v-else>
      <span class="zodiac-placeholder">+ 选择星座</span>
    </template>
  </button>

  <Teleport to="body">
    <Transition name="zodiac-sheet">
      <div v-if="open" class="zodiac-mask" @click.self="open = false">
        <div class="zodiac-sheet" role="dialog" aria-label="选择星座">
          <div class="zodiac-handle"></div>

          <header class="zodiac-header">
            <h3 class="zodiac-title">选择星座</h3>
            <p class="zodiac-sub">12 星座 · 西方 · 按出生月日</p>
          </header>

          <div class="zodiac-body">
            <div class="zodiac-grid">
              <button
                v-for="z in ZODIACS"
                :key="z.code"
                type="button"
                class="zodiac-pill-btn"
                :class="{ 'zodiac-pill-active': selected === z.code }"
                :style="selected === z.code ? { background: z.color, borderColor: z.color, color: 'white' } : { borderColor: z.color, color: z.color }"
                @click="pick(z.code)"
              >
                <span class="zodiac-pill-name">{{ z.name }}</span>
              </button>
            </div>
          </div>

          <footer class="zodiac-footer">
            <button class="zodiac-done" @click="open = false">完成</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ===== 触发按钮 ===== */
.zodiac-trigger {
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
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
  text-align: left;
  color: #a8a39a;
}

.zodiac-trigger:hover {
  border-color: #b8ad95;
  background: #ffffff;
  color: #5c5953;
}

.zodiac-trigger-active {
  font-weight: 500;
}

.zodiac-placeholder {
  flex: 1;
}

.zodiac-emoji {
  font-size: 18px;
  line-height: 1;
}

.zodiac-name {
  font-weight: 700;
  font-size: 14px;
}

.zodiac-date {
  flex: 1;
  font-size: 11px;
  color: #8c8780;
  margin-left: 4px;
}

.zodiac-clear {
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

.zodiac-clear:hover {
  background: rgba(0, 0, 0, 0.15);
}

/* ===== 弹窗 ===== */
.zodiac-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
}

.zodiac-sheet {
  background: #fffaf0;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 24px rgba(43, 42, 38, 0.18);
  overflow: hidden;
}

.zodiac-handle {
  width: 36px;
  height: 4px;
  background: #d4cfc4;
  border-radius: 2px;
  margin: 8px auto 4px;
  flex-shrink: 0;
}

.zodiac-header {
  padding: 8px 18px 14px;
  border-bottom: 1px solid #f0ede5;
  flex-shrink: 0;
}

.zodiac-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #2b2a26;
}

.zodiac-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #a8a39a;
}

.zodiac-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px 12px;
  -webkit-overflow-scrolling: touch;
}

.zodiac-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.zodiac-pill-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 6px;
  background: white;
  border: 1.5px solid;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  font-family: inherit;
  text-align: center;
}

.zodiac-pill-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.zodiac-pill-active {
  font-weight: 600;
}

.zodiac-pill-emoji {
  font-size: 24px;
  line-height: 1;
  margin-bottom: 4px;
}

.zodiac-pill-name {
  font-size: 13px;
  font-weight: 600;
}

.zodiac-pill-date {
  font-size: 10px;
  margin-top: 3px;
}

.zodiac-footer {
  padding: 12px 18px 24px;
  border-top: 1px solid #f0ede5;
  flex-shrink: 0;
  background: #fffaf0;
}

.zodiac-done {
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

.zodiac-done:active {
  background: #3a3528;
}

/* ===== 过渡 ===== */
.zodiac-sheet-enter-active,
.zodiac-sheet-leave-active {
  transition: opacity 0.25s ease;
}

.zodiac-sheet-enter-active .zodiac-sheet,
.zodiac-sheet-leave-active .zodiac-sheet {
  transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
}

.zodiac-sheet-enter-from,
.zodiac-sheet-leave-to {
  opacity: 0;
}

.zodiac-sheet-enter-from .zodiac-sheet,
.zodiac-sheet-leave-to .zodiac-sheet {
  transform: translateY(100%);
}
</style>
