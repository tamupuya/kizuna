<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface InterestCategory {
  name: string
  works: string[]
  state?: 'A' | 'B' | 'C'
}

interface Props {
  modelValue: InterestCategory[]
  onSync?: (val: InterestCategory[]) => void
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [val: InterestCategory[]]
}>()

const MAX_WORKS = 3
const MAX_NG_TAGS = 10
const NG_CATEGORY_NAME = '避雷 (NG)'

// ===== 预设数据（必须先于 initFromProps 声明，否则 TDZ 抛错）=====
const CATEGORY_PRESETS: Array<{ name: string; presetWorks: string[] }> = [
  { name: '动画', presetWorks: ['葬送的芙莉莲','孤独摇滚！','进击的巨人','鬼灭之刃','咒术回战','新世纪福音战士','凉宫春日的忧郁','轻音少女','BanG Dream!','LoveLive!','紫罗兰永恒花园','CLANNAD','Angel Beats!','Re:从零开始的异世界生活','我的青春恋爱物语果然有问题','86-不存在的战区-','来自深渊','少女终末旅行','青春猪头少年不会梦到兔女郎学姐','败犬女主太多了！','赛博朋克：边缘行者','刀剑神域','命运石之门','物语系列','夏目友人帐','妖精的尾巴','路人女主的养成方法','四月是你的谎言','未闻花名','幸运星'] },
  { name: '漫画', presetWorks: ['电锯人','我推的孩子','蓝色监狱','排球少年！！','间谍过家家','辉夜大小姐想让我告白','跃动青春','地缚少年花子君','彻夜之歌','怪兽8号','咒术回战','鬼灭之刃','海贼王','火影忍者','死神','钢之炼金术师','在超市后门吸烟的二人','进击的巨人','名侦探柯南','擅长逃跑的殿下'] },
  { name: '游戏', presetWorks: ['原神','崩坏：星穹铁道','绝区零','鸣潮','明日方舟','碧蓝航线','蔚蓝档案','Fate/Grand order','第五人格','英雄联盟','无畏契约','主播女孩重度依赖','女神异闻录5','最终幻想14','星露谷物语','战双帕弥什','少女前线','东方Project','尼尔：机械纪元','NIKKE：胜利女神'] },
  { name: 'Galgame', presetWorks: ['美好的每一天～不连续的存在～','9-nine-','缘之空','白色相簿2','CLANNAD','Rewrite','Summer Pockets','Little Busters!','命运石之门','ATRI -My Dear Moments-','千恋万花','近月少女的礼仪','樱之诗','月姬 -A piece of blue glass moon-','少女理论及其周边'] },
  { name: '声优', presetWorks: ['花泽香菜','早见沙织','佐仓绫音','水濑祈','上坂堇','小仓唯','悠木碧','鬼头明里','花守由美里','梶裕贵','宫野真守','神谷浩史','松冈祯丞','下野纮','内田真礼','石川由依','山新','醋醋','杨天翔','赵路','边江','苏尚卿','张杰','阿杰','陈张太康','叶知秋'] },
  { name: 'CP', presetWorks: ['五条悟 × 夏油杰','太宰治 × 中原中也','利威尔 × 艾伦','影山飞雄 × 日向翔阳','宫侑 × 日向翔阳','凪诚士郎 × 御影玲王','喜多郁代 × 后藤一里','钟离 × 达达利亚','雷电将军 × 八重神子','空 × 荧','牧濑红莉栖 × 岡部伦太郎','鲁路修 × C.C.','桐人 × 亚丝娜','晓美焰 × 鹿目圆','虎杖悠仁 × 伏黑惠'] },
  { name: '角色', presetWorks: ['初音未来(VOCALOID)','绫波丽','惣流·明日香','御坂美琴','长门有希','芙莉莲','喜多郁代','后藤一里','灰原哀','灶门祢豆子','甘露寺蜜璃','五条悟','夏油杰','伏黑惠','影山飞雄','日向翔阳','太宰治','中原中也','2B','雷电将军','胡桃','纳西妲','雷塞','爱莉希雅','三月七','亚丝娜','桐人','鲁路修','三笠','爱德华·艾尔利克'] },
  { name: '唱见 / 舞见', presetWorks: ['Ado','Eve','YOASOBI','米津玄师','Reol','まふまふ','Sou','花谱','鹿乃','96猫'] },
  { name: '画师', presetWorks: ['米山舞','lack','森倉円','Hiten','望月けい','LAM','redjuice','岸田メル','あきま','neco','Mika Pikazo','深崎暮人','Tiv','竹花ノート','しらび','カントク','かんざきひろ','U35','DSマイル','Yoneyama Mai'] },
  { name: '特摄', presetWorks: ['《假面骑士W》','《假面骑士Build》','《假面骑士Ex-Aid》','《假面骑士极狐》','《假面骑士空我》','《假面骑士电王》','《迪迦奥特曼》','《戴拿奥特曼》','《盖亚奥特曼》','《奈克瑟斯奥特曼》','《泽塔奥特曼》','《布莱泽奥特曼》','《奥特曼》系列','《假面骑士》系列','《超级战队》系列'] },
  { name: '小说', presetWorks: ['《哈利波特》','《三体》','《魔道祖师》','《全职高手》','《诡秘之主》','《斗破苍穹》','《凡人修仙传》','《刀剑神域》','《Re:从零开始的异世界生活》','《无职转生》','《文学少女》','《青春猪头少年系列》','《我的青春恋爱物语果然有问题》','《86-不存在的战区-》','《凉宫春日系列》'] },
  { name: '偶像', presetWorks: ['VOCALOID','LoveLive!','偶像大师','BanG Dream!','偶像梦幻祭','IDOLiSH7','SNH48','AKB48','乃木坂46','虹咲学园偶像同好会'] },
  { name: '歌曲', presetWorks: ['《千本樱》','《Tell Your World》','《unravel》','《only my railgun》','《God knows》','《青鸟》','《红莲华》','《夜に駆ける》','《群青》','《アイドル》','《恋爱循环》','《极乐净土》','《secret base》','《残酷天使的行动纲领》','《Again》','《打上花火》','《花之塔》','《前前前世》','《春日影》','《星座になれたら》'] },
  { name: '电影 / 剧场版', presetWorks: ['《你的名字》','《天气之子》','《铃芽之旅》','《声之形》','《秒速5厘米》','《千与千寻》','《哈尔的移动城堡》','《龙猫》','《紫罗兰永恒花园剧场版》','《电锯人 雷塞篇》','《言叶之庭》','《穿越时空的少女》','《夏日大作战》','《萤火之森》','《企鹅公路》'] },
  { name: '演员', presetWorks: ['山崎贤人','菅田将晖','佐藤健','有村架纯','黑木华','长泽雅美','小松菜奈','桥本环奈','滨边美波','石原里美','新垣结衣','陈坤','刘亦菲','刘涛','胡歌','张若昀'] },
  { name: '服饰', presetWorks: ['JK制服','DK制服','洛丽塔','汉服','COS服','OL装','西装类','原宿风','森系穿搭','地雷系','量产系','哥特式','朋克风','Y2K','学院风'] },
  { name: '日剧/真人剧', presetWorks: ['《逃避虽可耻但有用》','《重启人生》','《孤独的美食家》','《非自然死亡》','《胜者即是正义》','《半泽直树》','《3年A班：从现在起，大家都是人质》','《轮到你了》','《我是大哥大！！》','《海女》'] },
  { name: '避雷 (NG)', presetWorks: [] },
]

const PRESET_BY_NAME = new Map(CATEGORY_PRESETS.map(p => [p.name, p.presetWorks]))
const PRESET_NAMES = new Set(CATEGORY_PRESETS.map(p => p.name))

function getPresetWorks(name: string): string[] {
  return PRESET_BY_NAME.get(name) || []
}

function isPreset(name: string) {
  return PRESET_NAMES.has(name)
}

// ===== 核心状态 =====
const localCats = ref<InterestCategory[]>([])
const catStates = ref<Record<string, 'A' | 'B' | 'C'>>({})
const expandedCat = ref<string | null>(null)
const inputDrafts = ref<Record<string, string>>({})

// ===== 初始化：从 props.modelValue 恢复 =====
function initFromProps() {
  const val = props.modelValue || []
  localCats.value = val.map(c => ({ ...c, works: [...c.works] }))

  // 恢复 catStates：DB 有什么 state 就恢复什么
  const states: Record<string, 'A' | 'B' | 'C'> = {}
  val.forEach(c => {
    // 老数据兼容：state 字段缺失时按 works 推断
    // 有作品：state=B 保持 B，其他视为 C
    // 无作品：state=B 保持 B，其他视为 A
    if (c.works.length > 0) {
      states[c.name] = c.state === 'B' ? 'B' : 'C'
    } else {
      states[c.name] = c.state === 'B' ? 'B' : 'A'
    }
  })
  // 对于不在 val 中的预设分类，设为 A
  CATEGORY_PRESETS.forEach(p => {
    if (!(p.name in states)) states[p.name] = 'A'
  })
  catStates.value = states
}

// 首次初始化
initFromProps()

// 监听外部数据变化（如数据库加载后）
watch(() => props.modelValue, (val) => {
  const sameLen = val.length === localCats.value.length
  const sameContent = sameLen && val.every((c, i) =>
    c.name === localCats.value[i]?.name &&
    c.works.length === localCats.value[i]?.works.length &&
    c.works.every((w, j) => w === localCats.value[i]?.works[j])
  )
  if (!sameContent) {
    initFromProps()
  }
}, { deep: true })

// ===== 计算属性 =====
const selectedNames = computed(() => new Set(localCats.value.map(c => c.name)))

function isSelected(name: string) {
  return selectedNames.value.has(name)
}

function getCat(name: string): InterestCategory | undefined {
  return localCats.value.find(c => c.name === name)
}

function getState(name: string): 'A' | 'B' | 'C' {
  return catStates.value[name] || 'A'
}

// ===== 核心：commit 输出 =====
function commit() {
  const out = localCats.value.map(c => ({
    ...c,
    works: [...c.works],
    state: catStates.value[c.name] || 'A'
  }))
  emit('update:modelValue', out)
  if (props.onSync) props.onSync(out)
}

// ===== 核心：ABC 状态机 =====

/**
 * 点击一级 chip
 * A → 打开弹窗（临时状态，不写入）
 * B → 打开弹窗继续编辑
 * C → 降为 B（不开弹窗）
 */
function toggleInterest(name: string) {
  const state = getState(name)
  
  if (state === 'A') {
    // A 态：加入 localCats（works 为空），打开弹窗
    if (!isSelected(name)) {
      localCats.value.push({ name, works: [], state: 'A' })
    }
    catStates.value[name] = 'A'
    expandedCat.value = name
  } else if (state === 'C') {
    // C 态：降为 B，不开弹窗
    catStates.value[name] = 'B'
  } else {
    // B 态：打开弹窗继续编辑
    expandedCat.value = name
  }
  commit()
}

// ===== 弹窗内操作 =====

function togglePresetWork(name: string, work: string) {
  const cat = getCat(name)
  if (!cat) return
  const idx = cat.works.indexOf(work)
  if (idx >= 0) {
    cat.works.splice(idx, 1)
  } else {
    const max = name === NG_CATEGORY_NAME ? MAX_NG_TAGS : MAX_WORKS
    if (cat.works.length >= max) {
      showToast(name === NG_CATEGORY_NAME ? `避雷最多 ${MAX_NG_TAGS} 个` : `最多 ${MAX_WORKS} 个作品`)
      return
    }
    cat.works.push(work)
  }
  commit()
}

function addCustomWork(name: string, text: string) {
  const v = text.trim()
  if (!v) return
  const cat = getCat(name)
  if (!cat) return
  if (cat.works.includes(v)) {
    inputDrafts.value[name] = ''
    return
  }
  const max = name === NG_CATEGORY_NAME ? MAX_NG_TAGS : MAX_WORKS
  if (cat.works.length >= max) {
    showToast(name === NG_CATEGORY_NAME ? `避雷最多 ${MAX_NG_TAGS} 个` : `最多 ${MAX_WORKS} 个作品`)
    return
  }
  const maxLen = name === NG_CATEGORY_NAME ? 20 : 12
  if (v.length > maxLen) {
    showToast(name === NG_CATEGORY_NAME ? '避雷标签不超过 20 字' : '作品名不超过 12 字')
    return
  }
  cat.works.push(v)
  inputDrafts.value[name] = ''
  commit()
}

function removeWork(catName: string, work: string) {
  const cat = getCat(catName)
  if (!cat) return
  cat.works = cat.works.filter(w => w !== work)
  commit()
}

function removeCategory(name: string) {
  if (expandedCat.value === name) expandedCat.value = null
  delete catStates.value[name]
  localCats.value = localCats.value.filter(c => c.name !== name)
  commit()
}

// ===== 弹窗控制 =====

const sheetOpen = computed(() => expandedCat.value !== null)

const currentCat = computed(() => {
  const name = expandedCat.value
  if (!name) return null
  const cat = getCat(name) || { name, works: [] }
  return {
    name,
    cat,
    isPreset: isPreset(name),
    isNg: name === NG_CATEGORY_NAME,
    presets: getPresetWorks(name),
    maxItems: name === NG_CATEGORY_NAME ? MAX_NG_TAGS : MAX_WORKS,
  }
})

/** 确认按钮：有作品 → C，无作品 → A */
function confirmSheet() {
  const name = expandedCat.value
  if (!name) return
  const cat = getCat(name)
  if (cat && cat.works.length > 0) {
    catStates.value[name] = 'C'
  } else {
    catStates.value[name] = 'A'
  }
  expandedCat.value = null
  commit()
}

/** 关闭弹窗（点遮罩/返回）：有作品 → B，无作品 → A */
function closeSheet() {
  const name = expandedCat.value
  if (!name) return
  const cat = getCat(name)
  if (cat && cat.works.length > 0) {
    catStates.value[name] = 'B'
  } else {
    catStates.value[name] = 'A'
  }
  inputDrafts.value[name] = ''
  expandedCat.value = null
  commit()
}

// ===== 自定义分类 =====

const showCustomInput = ref(false)
const customInput = ref('')

function addCustomCategory() {
  const v = customInput.value.trim()
  if (!v) return
  if (isSelected(v)) {
    customInput.value = ''
    showCustomInput.value = false
    return
  }
  if (v.length > 6) {
    showToast('分类名不超过 6 字')
    return
  }
  localCats.value.push({ name: v, works: [] })
  catStates.value[v] = 'A'
  expandedCat.value = v
  customInput.value = ''
  showCustomInput.value = false
  commit()
}

// ===== Toast =====

function showToast(msg: string) {
  const fn = (window as any).showToast
  if (typeof fn === 'function') fn(msg)
  else console.log('[toast]', msg)
}
</script>

<template>
  <div class="interest-builder">
    <!-- 一级 chip grid -->
    <div class="ib-grid">
      <button
        v-for="p in CATEGORY_PRESETS"
        :key="p.name"
        @click="toggleInterest(p.name)"
        class="ib-chip"
        :class="{
          'ib-chip-c': getState(p.name) === 'C',
          'ib-chip-b': getState(p.name) === 'B',
          'ib-chip-active': getState(p.name) === 'A' && expandedCat === p.name,
        }"
      >
        <span>{{ p.name }}</span>
        <span v-if="getState(p.name) === 'B' || getState(p.name) === 'C'" class="ib-badge">
          {{ getCat(p.name)?.works.length || 0 }}
        </span>
      </button>

      <!-- 自定义分类 -->
      <button
        v-for="cat in localCats.filter(c => !isPreset(c.name))"
        :key="`custom-${cat.name}`"
        @click="toggleInterest(cat.name)"
        class="ib-chip ib-chip-custom"
        :class="{
          'ib-chip-c': getState(cat.name) === 'C',
          'ib-chip-b': getState(cat.name) === 'B',
        }"
      >
        <span>{{ cat.name }}</span>
        <span v-if="getState(cat.name) === 'B' || getState(cat.name) === 'C'" class="ib-badge">
          {{ cat.works.length }}
        </span>
      </button>

      <!-- + 添加自定义分类 -->
      <button v-if="!showCustomInput" @click="showCustomInput = true" class="ib-add-btn">
        + 自定义分类
      </button>
    </div>

    <!-- 自定义分类输入 -->
    <div v-if="showCustomInput" class="ib-custom-row">
      <input
        v-model="customInput"
        @keydown.enter="addCustomCategory"
        type="text"
        maxlength="6"
        placeholder="输入分类名（≤6字）"
        class="ib-input"
      />
      <button @click="addCustomCategory" class="ib-confirm">+</button>
      <button @click="showCustomInput = false; customInput = ''" class="ib-cancel">取消</button>
    </div>
  </div>

  <!-- 二级弹窗 -->
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="sheetOpen && currentCat" class="ib-mask" @click.self="closeSheet">
        <div class="ib-sheet">
          <div class="ib-handle"></div>

          <header class="ib-header">
            <div>
              <h3>{{ currentCat.name }}</h3>
              <p>已选 {{ currentCat.cat.works.length }} / {{ currentCat.maxItems }}</p>
            </div>
            <button
              v-if="!currentCat.isPreset || localCats.length > 1"
              @click="removeCategory(currentCat.name)"
              class="ib-remove"
              :disabled="currentCat.isPreset && localCats.length <= 1"
            >删除</button>
          </header>

          <div class="ib-body">
            <!-- 自定义输入 -->
            <div class="ib-add-row">
              <input
                :value="inputDrafts[currentCat.name] || ''"
                @input="inputDrafts[currentCat.name] = ($event.target as HTMLInputElement).value"
                @keydown.enter="addCustomWork(currentCat.name, inputDrafts[currentCat.name] || '')"
                type="text"
                :maxlength="currentCat.isNg ? 20 : 12"
                :placeholder="currentCat.isNg ? '+ 添加避雷标签（≤10）' : '+ 添加自定义作品（≤12字）'"
                class="ib-input"
              />
              <button @click="addCustomWork(currentCat.name, inputDrafts[currentCat.name] || '')">+</button>
            </div>

            <!-- 预设作品 -->
            <section v-if="currentCat.presets.length > 0">
              <h4>预设</h4>
              <div class="ib-work-grid">
                <button
                  v-for="work in currentCat.presets"
                  :key="work"
                  @click="togglePresetWork(currentCat.name, work)"
                  :class="{ active: currentCat.cat.works.includes(work) }"
                >
                  {{ work }}
                </button>
              </div>
            </section>

            <!-- 自定义作品 -->
            <section v-if="currentCat.cat.works.some(w => !currentCat.presets.includes(w))">
              <h4>自定义</h4>
              <div class="ib-work-grid">
                <span
                  v-for="work in currentCat.cat.works.filter(w => !currentCat.presets.includes(w))"
                  :key="work"
                  class="ib-custom-work"
                >
                  {{ work }}
                  <button @click="removeWork(currentCat.name, work)">×</button>
                </span>
              </div>
            </section>
          </div>

          <footer class="ib-footer">
            <button @click="confirmSheet" class="ib-done">确认</button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.interest-builder { width: 100%; }

.ib-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.ib-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  border-radius: 18px;
  border: 1px solid #e0dcd4;
  background: #ffffff;
  color: #5c5953;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.ib-chip:hover { border-color: #b8ad95; color: #3a3528; }

/* A 态：白底浅灰字，无徽章 */
/* 默认样式就是 A 态 */

/* B 态：白底黑字 + 黑描边 + 灰色徽章 */
.ib-chip.ib-chip-b {
  background: #ffffff !important;
  color: #2b2a26 !important;
  border-color: #2b2a26 !important;
  font-weight: 600;
}
.ib-chip.ib-chip-b .ib-badge {
  background: #1a1a1a !important;
  color: #ffffff !important;
}

/* C 态：黑底白字 + 白底黑字徽章 */
.ib-chip.ib-chip-c {
  background: #2b2a26 !important;
  color: #fff5dc !important;
  border-color: #2b2a26 !important;
}
.ib-chip.ib-chip-c .ib-badge {
  background: #fff5dc !important;
  color: #2b2a26 !important;
}

/* A 态临时（弹窗打开中） */
.ib-chip.ib-chip-active {
  background: #2b2a26 !important;
  color: #fff5dc !important;
  border-color: #2b2a26 !important;
}

.ib-chip-custom { border-style: dashed; }

.ib-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.ib-add-btn {
  padding: 6px 14px;
  border-radius: 18px;
  border: 1.5px dashed #d4cfc4;
  background: transparent;
  color: #a8a39a;
  font-size: 13px;
  cursor: pointer;
}

.ib-custom-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.ib-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0dcd4;
  border-radius: 8px;
  background: #fafaf8;
  font-size: 13px;
  outline: none;
  color: #2b2a26;
}

.ib-confirm, .ib-cancel {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 13px;
}

.ib-confirm { background: #2b2a26; color: #fff5dc; }
.ib-cancel { background: none; border: 1px solid #e0dcd4; color: #a8a39a; }

/* 弹窗 */
.ib-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
}

.ib-sheet {
  background: #fffaf0;
  width: 100%;
  max-width: 480px;
  height: 75vh;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ib-handle {
  width: 36px;
  height: 4px;
  background: #d4cfc4;
  border-radius: 2px;
  margin: 8px auto 4px;
}

.ib-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 18px 12px;
  border-bottom: 1px solid #f0ede5;
}

.ib-header h3 { margin: 0; font-size: 17px; font-weight: 700; color: #2b2a26; }
.ib-header p { margin: 4px 0 0; font-size: 12px; color: #a8a39a; }

.ib-remove {
  background: none;
  border: none;
  color: #d97a5d;
  font-size: 12px;
  cursor: pointer;
}

.ib-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}

.ib-add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px dashed #f0ede5;
}

.ib-body h4 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #8c8780;
}

.ib-work-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ib-work-grid button {
  padding: 5px 12px;
  border-radius: 14px;
  border: 1px solid #e0dcd4;
  background: #ffffff;
  color: #5c5953;
  font-size: 12px;
  cursor: pointer;
}

.ib-work-grid button.active {
  background: #2b2a26 !important;
  color: #fff5dc !important;
  border-color: #2b2a26 !important;
}

.ib-custom-work {
  display: inline-flex;
  align-items: center;
  background: #f4f0e8;
  color: #5c4d2e;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.ib-custom-work button {
  background: none;
  border: none;
  color: #5c4d2e;
  opacity: 0.5;
  font-size: 14px;
  cursor: pointer;
  margin-left: 4px;
}

.ib-footer {
  padding: 12px 18px 24px;
  border-top: 1px solid #f0ede5;
}

.ib-done {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #2b2a26;
  color: #fff5dc;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.25s ease; }
.sheet-enter-active .ib-sheet, .sheet-leave-active .ib-sheet { transition: transform 0.3s cubic-bezier(.34,1.56,.64,1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .ib-sheet, .sheet-leave-to .ib-sheet { transform: translateY(100%); }
</style>