<script setup lang="ts">
/**
 * CodeField.vue — 编号输入组件（2026-08-02 按 image#1 重写）
 *
 * 只读态（默认）：显示 # 前缀 + 当前编号，整块可点击进入编辑态，没有 ↻ 按钮
 * 编辑态：输入框 + 右侧单一 √/× 状态指示器；onBlur 提交（✓ 写入 / ✗ 还原）
 */
import { ref, computed, watch } from 'vue'
import { validateCode } from '../lib/codeGenerator'

const props = defineProps<{
  modelValue: string
  cn: string
  users: Array<{ id?: string; code?: string; cn?: string }>
  selfId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const CODE_LEN = 6

const normalize = (v: string) => (v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, CODE_LEN)

const validation = computed(() => validateCode(draft.value, props.cn || '', props.users || [], props.selfId))

function startEdit() {
  draft.value = props.modelValue || ''
  editing.value = true
  setTimeout(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  }, 30)
}

function commitCodeEdit() {
  if (validation.value.ok) {
    emit('update:modelValue', normalize(draft.value))
  } else {
    draft.value = props.modelValue || ''
  }
  editing.value = false
}

function onInput(e: Event) {
  const t = e.target as HTMLInputElement
  draft.value = normalize(t.value)
  // 同步回 input（处理粘贴等场景）
  if (t.value !== draft.value) t.value = draft.value
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitCodeEdit()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    draft.value = props.modelValue || ''
    editing.value = false
  }
}

watch(() => props.modelValue, (v) => {
  if (!editing.value) draft.value = v || ''
})
</script>

<template>
  <div class="cf">
    <!-- 只读态 -->
    <button v-if="!editing" class="cf-display" @click="startEdit" type="button">
      <span class="cf-hash">#</span>
      <span class="cf-value">{{ modelValue || '------' }}</span>
      <span class="cf-edit-hint">编辑</span>
    </button>

    <!-- 编辑态 -->
    <div v-else class="cf-edit" :class="{ ok: validation.ok, bad: !validation.ok }">
      <span class="cf-hash">#</span>
      <input
        ref="inputRef"
        :value="draft"
        @input="onInput"
        @blur="commitCodeEdit"
        @keydown="onKey"
        class="cf-input"
        maxlength="6"
        placeholder="待定"
      />
      <span class="cf-status" :class="{ ok: validation.ok, bad: !validation.ok }">
        {{ validation.ok ? '✓' : '×' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.cf {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

/* 只读态 */
.cf-display {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid #dddddd;
  border-radius: 10px;
  background: #f7f7f7;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  color: #222222;
  font-weight: 600;
  transition: all 0.18s ease;
  box-sizing: border-box;
}

.cf-display:hover {
  border-color: #222222;
  background: #ffffff;
}

.cf-display:active {
  transform: scale(0.99);
}

.cf-hash {
  color: #717171;
  font-weight: 600;
  margin-right: 2px;
}

.cf-value {
  letter-spacing: 1px;
  color: #222222;
}

.cf-edit-hint {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: #717171;
}

/* 编辑态 */
.cf-edit {
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border: 1px solid #dddddd;
  border-radius: 10px;
  background: #ffffff;
  transition: all 0.18s ease;
  box-sizing: border-box;
}

.cf-edit:focus-within {
  border-color: #222222;
}

.cf-edit.ok {
  border-color: #2e7d32;
  background: #f1f8f4;
}

.cf-edit.bad {
  border-color: #c0392b;
  background: #fdf2f2;
}

.cf-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #222222;
  outline: none;
  font-family: inherit;
  min-width: 0;
}

.cf-input::placeholder {
  color: #b0b0b0;
  font-weight: 400;
  letter-spacing: 0;
}

.cf-status {
  font-size: 18px;
  font-weight: 700;
  margin-left: 8px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
}

.cf-status.ok {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.12);
}

.cf-status.bad {
  color: #c0392b;
  background: rgba(192, 57, 43, 0.12);
}
</style>