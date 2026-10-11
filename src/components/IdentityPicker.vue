<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAlertStore } from '../stores/alert'

interface Props {
  modelValue: string[]
  presets: string[]
  maxCount: number
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '选择标签'
})

const alert = useAlertStore()

const emit = defineEmits<{
  'update:modelValue': [val: string[]]
  'close': []
}>()

const show = ref(props.modelValue.length > 0 || !props.modelValue.every(v => v === ''))
const customInput = ref('')
const localSelected = ref<string[]>([...props.modelValue])

watch(() => props.modelValue, (val) => {
  localSelected.value = [...val]
})

const count = computed(() => localSelected.value.length)
const canAddCustom = computed(() => customInput.value.trim().length > 0 && count.value < props.maxCount)

function toggle(tag: string) {
  const idx = localSelected.value.indexOf(tag)
  if (idx >= 0) {
    localSelected.value.splice(idx, 1)
  } else {
    if (localSelected.value.length >= props.maxCount) {
      alert.warn(`最多只能选择 ${props.maxCount} 个`)
      return
    }
    localSelected.value.push(tag)
  }
}

function addCustom() {
  const v = customInput.value.trim()
  if (!v) return
  if (localSelected.value.includes(v)) {
    customInput.value = ''
    return
  }
  if (localSelected.value.length >= props.maxCount) {
    alert.warn(`最多只能选择 ${props.maxCount} 个`)
    return
  }
  localSelected.value.push(v)
  customInput.value = ''
}

function removeCustom(idx: number) {
  // Only allow removing items that were custom or selected by user
  localSelected.value.splice(idx, 1)
}

function confirm() {
  emit('update:modelValue', [...localSelected.value])
  emit('close')
  show.value = false
}

function cancel() {
  localSelected.value = [...props.modelValue]
  emit('close')
  show.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addCustom()
  }
}
</script>

<template>
  <!-- Trigger slot (click target) -->
  <div class="cursor-pointer" @click="show = true">
    <slot>
      <div class="picker-trigger">
        <span v-if="modelValue.length === 0" class="text-stone-400">点击选择</span>
        <div v-else class="flex flex-wrap gap-1.5">
          <span 
            v-for="tag in modelValue" 
            :key="tag"
            class="picker-tag"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </slot>
  </div>

  <!-- Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="picker-mask" @click.self="cancel">
        <Transition name="slide">
          <div v-if="show" class="picker-sheet">
            <!-- Header -->
            <div class="picker-header">
              <h3 class="picker-title">
                {{ title }}
                <span class="text-stone-400 text-sm font-normal ml-1">{{ count }}/{{ maxCount }}</span>
              </h3>
              <button 
                @click="cancel"
                class="text-stone-400 hover:text-stone-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <!-- Preset grid -->
            <div class="picker-grid">
              <button
                v-for="tag in presets"
                :key="tag"
                @click="toggle(tag)"
                class="picker-chip"
                :class="{ 'picker-chip-active': localSelected.includes(tag) }"
              >
                {{ tag }}
              </button>
            </div>

            <!-- Custom input -->
            <div class="picker-custom">
              <input
                v-model="customInput"
                @keydown="handleKeydown"
                type="text"
                maxlength="10"
                placeholder="自定义标签（回车添加）"
                class="picker-input"
              />
              <button
                @click="addCustom"
                :disabled="!canAddCustom"
                class="picker-add-btn"
              >
                添加
              </button>
            </div>

            <!-- Confirm -->
            <button @click="confirm" class="picker-confirm-btn">
              确认
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.picker-trigger {
  padding: 10px 14px;
  border: 1px solid #e8e6e1;
  border-radius: 8px;
  background: #fafaf8;
  min-height: 42px;
  display: flex;
  align-items: center;
  font-size: 14px;
}

.picker-tag {
  background: #f4f0e8;
  color: #5c4d2e;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 13px;
}

.picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.picker-sheet {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  padding: 20px 22px 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.picker-title {
  font-size: 18px;
  font-weight: 600;
  color: #2b2a26;
}

.picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.picker-chip {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid #e0dcd4;
  background: #ffffff;
  color: #5c5953;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.picker-chip:hover {
  border-color: #b8ad95;
  color: #3a3528;
}

.picker-chip-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

.picker-chip-active:hover {
  background: #3a3528;
  border-color: #3a3528;
  color: #fff5dc;
}

.picker-custom {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.picker-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e0dcd4;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 14px;
  outline: none;
}

.picker-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.picker-add-btn {
  padding: 10px 18px;
  border-radius: 8px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 0.18s ease;
}

.picker-add-btn:hover:not(:disabled) {
  background: #3a3528;
}

.picker-add-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.picker-confirm-btn {
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.18s ease;
}

.picker-confirm-btn:hover {
  background: #3a3528;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(40px);
}
</style>
