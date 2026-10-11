// verify-apk-entry.cjs — 核验 APK 内配对功能「有门可进」
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const apk = 'D:/deepseekharness/datachange/kizuna/android/app/build/outputs/apk/debug/app-debug.apk'
const buf = fs.readFileSync(apk)

// 极简 zip 中央目录解析
function findEntries(buf) {
  const out = []
  // 从尾部找 EOCD (0x06054b50)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 70000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('EOCD not found')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const cmtLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    out.push({ name, method, compSize, localOff })
    off += 46 + nameLen + extraLen + cmtLen
  }
  return out
}

function readEntry(buf, e) {
  const nameLen = buf.readUInt16LE(e.localOff + 26)
  const extraLen = buf.readUInt16LE(e.localOff + 28)
  const start = e.localOff + 30 + nameLen + extraLen
  const data = buf.slice(start, start + e.compSize)
  if (e.method === 0) return data
  return zlib.inflateRawSync(data)
}

const entries = findEntries(buf)
const webAssets = entries.filter(e => e.name.startsWith('assets/public/assets/'))
console.log('APK web assets:', webAssets.length)

function grab(prefix) {
  // 优先 .js（CSS 不含逻辑，会误导统计）
  const e = webAssets.find(x => x.name.includes(prefix) && x.name.endsWith('.js'))
    || webAssets.find(x => x.name.includes(prefix))
  if (!e) return null
  return { name: e.name, text: readEntry(buf, e).toString('utf8') }
}

// 1) 门：AddView 是否有 /pair 入口
for (const chunk of ['AddView-', 'HomeView-', 'TabBar-']) {
  const g = grab(chunk)
  if (!g) { console.log(`\n[${chunk}] 未找到`); continue }
  const hits = (g.text.match(/\/pair/g) || []).length
  console.log(`\n[${g.name}] "/pair" 出现 ${hits} 次`)
  const ctx = g.text.match(/.{0,45}\/pair.{0,45}/g) || []
  ctx.slice(0, 4).forEach(c => console.log('   ...' + c + '...'))
}

// 2) 配对 chunk 关键逻辑
const pv = grab('PairView-')
if (pv) {
  console.log(`\n[${pv.name}] 关键内容：`)
  for (const k of ['pair_signals', '推窗', '跳过', '接受', '愿意', '再看看', '池', '人也在']) {
    const c = (pv.text.match(new RegExp(k, 'g')) || []).length
    if (c) console.log(`   ${k}: ${c}`)
  }
}

// 3) 死视图确认不在
const idx = grab('index-')
if (idx) {
  console.log(`\n[${idx.name}] 死视图残留检查：`)
  for (const k of ['RadarRoomsView', 'ExposView', 'AdminLoginView', 'TencentMap', 'PullRefresh', 'ErrorBoundary']) {
    console.log(`   ${k}: ${(idx.text.match(new RegExp(k, 'g')) || []).length}`)
  }
  console.log(`   /pair 路由: ${(idx.text.match(/"\/pair"/g) || []).length}`)
}
