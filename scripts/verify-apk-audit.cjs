/**
 * verify-apk-audit.cjs — 核验本次审查修复是否真的进了 APK
 *
 * 目的：防止「源码改了但 APK 是旧代码」这个历史上踩过的坑。
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const apk = process.argv[2]
if (!apk || !fs.existsSync(apk)) {
  console.error('用法: node verify-apk-audit.cjs <apk路径>')
  process.exit(1)
}

// 解析 APK（zip）中的 assets/public/assets/*.js
function readZipEntries(buf) {
  const entries = []
  // 从尾部找 End of Central Directory
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('未找到 EOCD')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    entries.push({ name, method, compSize, localOff })
    off += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function extract(buf, entry) {
  const lo = entry.localOff
  if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error('bad local header')
  const nameLen = buf.readUInt16LE(lo + 26)
  const extraLen = buf.readUInt16LE(lo + 28)
  const start = lo + 30 + nameLen + extraLen
  const raw = buf.subarray(start, start + entry.compSize)
  return entry.method === 0 ? raw : zlib.inflateRawSync(raw)
}

const buf = fs.readFileSync(apk)
const entries = readZipEntries(buf)
const assets = entries.filter(e => /^assets\/public\/assets\/.*\.js$/.test(e.name))

console.log(`APK: ${path.basename(apk)}`)
console.log(`web js 资产数: ${assets.length}\n`)

// 本次审查新增/修改的关键字（必须出现在包里）
const checks = [
  { key: 'pair_decisions',  desc: '双向确认表（本次新增）' },
  { key: 'waitingMutual',   desc: '等待对方确认状态' },
  { key: '你愿意了',         desc: '双向确认 UI 文案' },
  { key: '不能替他决定',     desc: '替对方表态提示' },
  { key: 'pair_signals',    desc: '信号池' },
  { key: '推窗',            desc: '推窗入口' },
  { key: '此刻也在这个场景里的人', desc: '池子规模文案' },
]

// 反例：不应出现的内容
const forbidden = [
  { key: 'kizuna-2026-r1kk-admin', desc: '后台硬编码密钥' },
  { key: 'admin_audit_logs',       desc: 'admin 审计表' },
]

const all = assets.map(e => extract(buf, e).toString('utf8'))
const joined = all.join('\n')

console.log('=== 应存在 ===')
let ok = true
for (const c of checks) {
  const n = joined.split(c.key).length - 1
  const mark = n > 0 ? '✅' : '❌'
  if (n === 0) ok = false
  console.log(`  ${mark} ${c.desc}  "${c.key}" × ${n}`)
}

console.log('\n=== 应不存在（安全核查）===')
for (const c of forbidden) {
  const n = joined.split(c.key).length - 1
  const mark = n === 0 ? '✅' : '❌'
  if (n > 0) ok = false
  console.log(`  ${mark} ${c.desc}  "${c.key}" × ${n}`)
}

// 旧死视图残留
console.log('\n=== 死视图残留 ===')
for (const d of ['RadarRoomsView', 'ExposView', 'AdminLoginView', 'TencentMap', 'PullRefresh', 'ErrorBoundary']) {
  const n = joined.split(d).length - 1
  console.log(`  ${n === 0 ? '✅' : '⚠️'} ${d} × ${n}`)
}

console.log('\n' + (ok ? '✅ APK 内容核验通过' : '❌ APK 内容核验失败'))
