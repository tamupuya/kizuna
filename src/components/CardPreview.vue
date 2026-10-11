<script setup lang="ts">
import type { User } from '../lib/mockData'

const props = defineProps<{
  user: User
}>()

const genderMap: Record<string, string> = {
  male: '男',
  female: '女',
  private: '保密'
}
</script>

<template>
  <div class="glass-card p-6 max-w-md mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <img 
        :src="user.avatar_url" 
        :alt="user.cn"
        class="w-20 h-20 rounded-full object-cover border-2 border-white/20"
      />
      <div>
        <h2 class="text-2xl font-bold">{{ user.cn }}</h2>
        <p class="text-sm opacity-60">{{ genderMap[user.gender] }}</p>
      </div>
    </div>

    <!-- Bio -->
    <p class="text-sm mb-6 opacity-80">{{ user.bio }}</p>

    <!-- Identity Tags -->
    <div class="mb-4">
      <h3 class="text-xs uppercase tracking-wider opacity-50 mb-2">身份</h3>
      <div class="flex flex-wrap gap-2">
        <span 
          v-for="tag in user.identity_tags" 
          :key="tag"
          class="chip"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Interest Tags -->
    <div>
      <h3 class="text-xs uppercase tracking-wider opacity-50 mb-2">兴趣</h3>
      <div class="flex flex-wrap gap-2">
        <span 
          v-for="tag in user.interest_tags" 
          :key="tag"
          class="chip chip-active"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>
