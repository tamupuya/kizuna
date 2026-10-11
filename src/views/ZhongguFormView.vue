<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKizunaStore } from '../stores/kizuna'
import { supabase } from '../lib/supabase'
import { uploadListingImages, type UploadedImage } from '../lib/storage'
import { RETURN_POLICY_OPTIONS, RETURN_SHIPPING_OPTIONS } from '../lib/mockData'
import { useAlertStore } from '../stores/alert'

const router = useRouter()
const store = useKizunaStore()
const alert = useAlertStore()
const saving = ref(false)
const uploading = ref(false)

const form = ref({
  type: 'sell' as 'sell' | 'want' | 'exchange',
  ip_tag: '',
  character: '',
  title: '',
  price: '' as string | number,
  description: '',
  tags: '' as string,
  trade_mode: 'mail' as 'mail' | 'meetup',  //  邮寄/自提
  address: '',
  addressNote: '',
  meetupPlace: '',  //  自提地点（可选）
  images: [] as UploadedImage[],
  // P2 新增
  return_policy: 'no_return' as 'no_return' | '7d_defect' | '14d_defect' | '7d_mismatch' | '14d_mismatch' | '7d_full' | '14d_full',
  return_shipping: 'buyer' as 'seller' | 'buyer' | 'split',
  return_note: '',
  seller_wechat: '',
  seller_qq: '',
})

const MAX_IMAGES = 9

const typeOptions = [
  { value: 'sell' as const, label: '出', desc: '出掉手里的谷子' },
  { value: 'want' as const, label: '求', desc: '求购想要的谷子' },
  { value: 'exchange' as const, label: '换', desc: '交换谷子' },
]

const ipPresets = ['原神', '崩坏星穹铁道', '明日方舟', '绝区零', '鸣潮', '咒术回战', '排球少年', '蓝色监狱', 'EVA', '高达', '新世纪福音战士']

onMounted(async () => {
  if (store.users.length === 0) {
    await store.fetchUsers()
  }
})

const canAddImage = computed(() => form.value.images.length < MAX_IMAGES)

async function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const files = Array.from(target.files)
  // reset input
  target.value = ''

  const remaining = MAX_IMAGES - form.value.images.length
  if (files.length > remaining) {
    alert.warn(`最多只能上传 ${MAX_IMAGES} 张照片`, `已选 ${files.length} 张，将上传前 ${remaining} 张`)
  }
  const toUpload = files.slice(0, remaining)

  uploading.value = true
  try {
    const uploaded = await uploadListingImages(toUpload, store.currentUserId || 'anon')
    form.value.images = [...form.value.images, ...uploaded]
  } catch (err: any) {
    alert.error('上传失败', err.message || String(err))
  } finally {
    uploading.value = false
  }
}

function removeImage(idx: number) {
  form.value.images = form.value.images.filter((_, i) => i !== idx)
}

async function save() {
  if (!form.value.title.trim() || !form.value.ip_tag.trim()) {
    alert.warn('请填写标题和 IP 标签')
    return
  }
  if (form.value.images.length === 0) {
    if (!(await alert.confirm('没有上传图片，确定继续吗？'))) return
  }

  saving.value = true
  try {
    const tags = form.value.tags
      ? form.value.tags.split(/[,，、\s]+/).filter(Boolean)
      : []

    const payload: any = {
      owner_id: store.currentUserId,
      type: form.value.type,
      ip_tag: form.value.ip_tag,
      character: form.value.character || null,
      title: form.value.title,
      price: form.value.price ? parseInt(String(form.value.price)) : null,
      description: form.value.description || null,
      tags,
      trade_mode: form.value.trade_mode,
      address: form.value.trade_mode === 'mail' ? form.value.address.trim() || null : null,
      address_note: form.value.trade_mode === 'mail' ? form.value.addressNote.trim() || null : null,
      meetup_place: form.value.trade_mode === 'meetup' ? form.value.meetupPlace.trim() || null : null,
      images: form.value.images.map(i => i.url),
      status: 'active',
      return_policy: form.value.return_policy,
      return_shipping: form.value.return_shipping,
      return_note: form.value.return_note.trim() || null,
      seller_wechat: form.value.seller_wechat.trim() || null,
      seller_qq: form.value.seller_qq.trim() || null,
    }

    const { error } = await supabase
      .from('zhonggu_listings')
      .insert(payload)

    if (error) throw error

    await store.fetchListings()
    // 2026-10-03：发布后跳「关注」tab，让用户立刻看到自己刚挂出的商品
    // （自己的挂出只在关注 tab 可见，跳推荐 tab 会看不到刚发的商品）
    router.push('/zhonggu?tab=follow')
  } catch (err: any) {
    console.error('Save failed:', err)
    alert.error('发布失败', err.message || '未知错误')
  }
  saving.value = false
}
</script>

<template>
  <div v-if="!store.currentUserId" class="zg-form-page">
    <div class="top-bar">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="page-title">需要你的卡</h1>
      <div style="width: 24px"></div>
    </div>
    <div class="needs-user">
      <div class="nu-card">
        <h2 class="nu-title"></h2>
        <p class="nu-desc"></p>
        <button @click="router.push('/editor')" class="nu-cta">去创建</button>
        <button @click="router.back()" class="nu-skip">返回</button>
      </div>
    </div>
  </div>

  <div v-else class="zg-form-page">
    <div class="top-bar">
      <button @click="router.back()" class="back-btn">←</button>
      <h1 class="page-title">发布挂出</h1>
      <div style="width: 24px"></div>
    </div>

    <div class="zg-form-shell">
      <!-- 类型 — 自然系高对比 -->
      <section class="form-card">
        <label class="form-label">类型</label>
        <div class="type-grid">
          <button
            v-for="opt in typeOptions"
            :key="opt.value"
            @click="form.type = opt.value"
            class="type-btn"
            :class="{ 'type-btn-active': form.type === opt.value }"
          >
            <span class="type-label">{{ opt.label }}</span>
            <span class="type-desc">{{ opt.desc }}</span>
          </button>
        </div>
      </section>

      <!-- 图片上传 -->
      <section class="form-card">
        <label class="form-label">
          图片
          <span class="form-label-meta">{{ form.images.length }}/{{ MAX_IMAGES }}</span>
        </label>

        <div class="image-grid">
          <div
            v-for="(img, idx) in form.images"
            :key="img.url"
            class="image-thumb"
          >
            <img :src="img.url" :alt="`图${idx + 1}`" />
            <button
              type="button"
              @click="removeImage(idx)"
              class="image-remove"
            >×</button>
          </div>

          <label
            v-if="canAddImage"
            class="image-upload-btn"
            :class="{ 'image-upload-disabled': uploading }"
          >
            <input
              type="file"
              accept="image/*"
              multiple
              @change="onFileChange"
              :disabled="uploading"
              class="image-input-hidden"
            />
            <span class="upload-plus" v-if="!uploading">+</span>
            <span class="upload-spinner" v-else>…</span>
            <span class="upload-hint">{{ uploading ? '上传中...' : '上传图片' }}</span>
          </label>
        </div>
        <p class="form-hint">最多 {{ MAX_IMAGES }} 张，每张 ≤ 5MB，建议正方形或竖图</p>
      </section>

      <!-- IP Tag -->
      <section class="form-card">
        <label class="form-label">IP 标签 *</label>
        <div class="ip-chip-row">
          <button
            v-for="ip in ipPresets"
            :key="ip"
            @click="form.ip_tag = ip"
            class="ip-chip"
            :class="{ 'ip-chip-active': form.ip_tag === ip }"
          >
            {{ ip }}
          </button>
        </div>
        <input
          v-model="form.ip_tag"
          type="text"
          maxlength="20"
          class="form-input"
          placeholder="可添加tag"
        />
      </section>

      <!-- 角色 -->
      <section class="form-card">
        <label class="form-label">角色（可选）</label>
        <input
          v-model="form.character"
          type="text"
          maxlength="20"
          class="form-input"
          placeholder="如：小樱"
        />
      </section>

      <!-- 标题 -->
      <section class="form-card">
        <label class="form-label">标题 *</label>
        <input
          v-model="form.title"
          type="text"
          maxlength="50"
          class="form-input"
          placeholder="如：小樱"
        />
      </section>

      <!-- 价格 -->
      <section class="form-card">
        <label class="form-label">价格（元）</label>
        <input
          v-model="form.price"
          type="number"
          min="0"
          class="form-input"
          placeholder=""
        />
      </section>

      <!-- 描述 -->
      <section class="form-card">
        <label class="form-label">详细描述</label>
        <textarea
          v-model="form.description"
          rows="3"
          class="form-input form-textarea"
          placeholder="物品简介"
        ></textarea>
      </section>

      <!-- Tags -->
      <section class="form-card">
        <label class="form-label">标签（逗号分隔）</label>
        <input
          v-model="form.tags"
          type="text"
          class="form-input"
          placeholder="如：吧唧、色卡、立牌、服装、道具..."
        />
      </section>

      <!-- 交易方式  邮寄 / 自提 -->
      <section class="form-card">
        <label class="form-label">交易方式 *</label>
        <div class="trade-mode-row">
          <button
            type="button"
            @click="form.trade_mode = 'mail'"
            class="trade-mode-btn"
            :class="{ 'trade-mode-btn-active': form.trade_mode === 'mail' }"
          >
            <span class="trade-mode-label">邮寄</span>
          </button>
          <button
            type="button"
            @click="form.trade_mode = 'meetup'"
            class="trade-mode-btn"
            :class="{ 'trade-mode-btn-active': form.trade_mode === 'meetup' }"
          >
            <span class="trade-mode-label">自提</span>
          </button>
        </div>
      </section>

      <!-- 邮寄 / 自提 地址 -->
      <section v-if="form.trade_mode === 'mail'" class="form-card">
        <label class="form-label">
          收件地址
          <span class="form-label-meta">拍下后可见</span>
        </label>
        <input
          v-model="form.address"
          type="text"
          maxlength="80"
          class="form-input"
          placeholder="如：北京市朝阳区XX路XX号"
        />
        <input
          v-model="form.addressNote"
          type="text"
          maxlength="60"
          class="form-input"
          style="margin-top: 8px;"
          placeholder="交易方式、物流情况、其他说明..."
        />
      </section>

      <section v-else class="form-card">
        <label class="form-label">
          自提地点（选填）
          <span class="form-label-meta">如：展会现场或同城某地</span>
        </label>
        <input
          v-model="form.meetupPlace"
          type="text"
          maxlength="60"
          class="form-input"
          placeholder=""
        />
      </section>

      <!-- 退换政策 P2 必填 -->
      <section class="form-card">
        <label class="form-label">
          退换政策 *
          <span class="form-label-meta">拍下后可见</span>
        </label>
        <div class="policy-grid">
          <button
            v-for="opt in RETURN_POLICY_OPTIONS"
            :key="opt.value"
            @click="form.return_policy = opt.value"
            class="policy-chip"
            :class="{ 'policy-chip-active': form.return_policy === opt.value }"
          >
            <span class="policy-label">{{ opt.label }}</span>
            <span class="policy-desc">{{ opt.desc }}</span>
          </button>
        </div>

        <label class="form-label" style="margin-top: 12px;">退货运费</label>
        <div class="shipping-row">
          <button
            v-for="opt in RETURN_SHIPPING_OPTIONS"
            :key="opt.value"
            @click="form.return_shipping = opt.value"
            class="ship-chip"
            :class="{ 'ship-chip-active': form.return_shipping === opt.value }"
          >
            {{ opt.label }}
          </button>
        </div>

        <textarea
          v-model="form.return_note"
          rows="2"
          maxlength="100"
          class="form-input form-textarea"
          style="margin-top: 10px;"
          placeholder="补充说明"
        ></textarea>
      </section>

      <!-- 联系方式 P2 仅拍下后可见 -->
      <section class="form-card">
        <label class="form-label">
          联系方式
          <span class="form-label-meta">仅买家拍下后可见</span>
        </label>
        <input
          v-model="form.seller_wechat"
          type="text"
          maxlength="40"
          class="form-input"
          placeholder=""
        />
        <input
          v-model="form.seller_qq"
          type="text"
          maxlength="20"
          class="form-input"
          style="margin-top: 8px;"
          placeholder=""
        />
        <p class="form-hint">买家拍下后才会看到你的显示方式</p>
      </section>

      <!-- Submit -->
      <button
        @click="save"
        :disabled="saving || uploading"
        class="form-submit"
      >
        {{ saving ? '发布中...' : '发布' }}
      </button>

      <div class="safe-bottom" />
    </div>
  </div>
</template>

<style scoped>
.zg-form-page {
  min-height: 100vh;
  background: #fafaf8;
  padding: 20px;
}

/* Needs-user state */
.needs-user {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nu-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  border: 1px solid #f0ede5;
  max-width: 320px;
}

.nu-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

.nu-title {
  font-size: 17px;
  font-weight: 700;
  color: #2b2a26;
  margin-bottom: 6px;
}

.nu-desc {
  font-size: 13px;
  color: #5c5953;
  margin-bottom: 18px;
  line-height: 1.5;
}

.nu-cta {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  margin-bottom: 6px;
}

.nu-skip {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  background: transparent;
  color: #a8a39a;
  font-size: 13px;
  border: none;
  cursor: pointer;
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

.zg-form-shell {
  max-width: 480px;
  margin: 0 auto;
}

.form-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 12px;
  border: 1px solid #f0ede5;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2b2a26;
  margin-bottom: 12px;
}

.form-label-meta {
  font-size: 11px;
  color: #a8a39a;
  font-weight: 400;
  margin-left: 8px;
}

.form-hint {
  font-size: 11px;
  color: #a8a39a;
  margin-top: 8px;
}

/* Type — 自然系高对比 */
.type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.type-btn {
  padding: 14px 8px;
  border-radius: 12px;
  border: 1.5px solid #e8e6e1;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.type-btn:hover {
  border-color: #b8ad95;
}

.type-btn-active {
  background: #2b2a26;
  border-color: #2b2a26;
}

.type-btn-active .type-label {
  color: #fff5dc;
}

.type-btn-active .type-desc {
  color: #d4cfc4;
}

.type-label {
  font-size: 20px;
  font-weight: 700;
  color: #2b2a26;
}

.type-desc {
  font-size: 11px;
  color: #a8a39a;
}

/* Image upload */
.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.image-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e8e6e1;
  background: #fafaf8;
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border: none;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-remove:hover {
  background: rgba(0, 0, 0, 0.85);
}

.image-upload-btn {
  aspect-ratio: 1;
  border: 1.5px dashed #d4cfc4;
  background: #fafaf8;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.image-upload-btn:hover {
  border-color: #b8ad95;
  background: #ffffff;
}

.image-upload-disabled {
  opacity: 0.6;
  cursor: wait;
}

.image-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.upload-plus {
  font-size: 24px;
  font-weight: 300;
  color: #b8ad95;
  line-height: 1;
}

.upload-spinner {
  font-size: 18px;
  color: #b8ad95;
}

.upload-hint {
  font-size: 10px;
  color: #a8a39a;
}

/* IP chips */
.ip-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.ip-chip {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid #e0dcd4;
  background: #ffffff;
  color: #5c5953;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.ip-chip:hover {
  border-color: #b8ad95;
}

.ip-chip-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

/* Return policy P2 */
.policy-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.policy-chip {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid #e0dcd4;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: left;
}

.policy-chip:hover {
  border-color: #b8ad95;
}

.policy-chip-active {
  background: #2b2a26;
  border-color: #2b2a26;
}

.policy-chip-active .policy-label {
  color: #fff5dc;
}

.policy-chip-active .policy-desc {
  color: #d4cfc4;
}

.policy-label {
  font-size: 13px;
  font-weight: 600;
  color: #2b2a26;
}

.policy-desc {
  font-size: 11px;
  color: #a8a39a;
}

.shipping-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ship-chip {
  padding: 6px 14px;
  border-radius: 16px;
  border: 1px solid #e0dcd4;
  background: #ffffff;
  color: #5c5953;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.ship-chip:hover {
  border-color: #b8ad95;
}

.ship-chip-active {
  background: #2b2a26;
  color: #fff5dc;
  border-color: #2b2a26;
}

/* Input */
.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e0dcd4;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 14px;
  outline: none;
  color: #2b2a26;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #b8ad95;
  background: #ffffff;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

/* Trade mode  邮寄 / 自提 */
.trade-mode-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.trade-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1.5px solid #e0dcd4;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
}

.trade-mode-btn:hover {
  border-color: #b8ad95;
}

.trade-mode-btn-active {
  background: #2b2a26;
  border-color: #2b2a26;
}

.trade-mode-btn-active .trade-mode-label {
  color: #fff5dc;
}

.trade-mode-emoji {
  font-size: 20px;
  line-height: 1;
}

.trade-mode-label {
  font-size: 15px;
  font-weight: 700;
  color: #2b2a26;
}

/* Submit */
.form-submit {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.18s ease;
  margin-top: 8px;
}

.form-submit:hover:not(:disabled) {
  background: #3a3528;
}

.form-submit:disabled {
  opacity: 0.5;
  cursor: wait;
}

.safe-bottom {
  height: 24px;
}
</style>