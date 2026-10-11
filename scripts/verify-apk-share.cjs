const fs = require('fs')
const path = require('path')

const apk = process.argv[2] || 'android/app/build/outputs/apk/debug/app-debug.apk'
const buf = fs.readFileSync(apk)

// APK 是 zip：只扫描中央目录里的文件名 + 全包里搜关键字符串
function findStrings(buf, list) {
  const out = {}
  for (const s of list) {
    const b = Buffer.from(s, 'utf8')
    let idx = buf.indexOf(b)
    let count = 0
    while (idx >= 0 && count < 999) { count++; idx = buf.indexOf(b, idx + 1) }
    out[s] = count
  }
  return out
}

// 提取 zip 文件名列表（中央目录）
const names = []
for (let i = 0; i < buf.length - 4; i++) {
  if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x01 && buf[i+3] === 0x02) {
    const nameLen = buf.readUInt16LE(i + 28)
    const name = buf.slice(i + 46, i + 46 + nameLen).toString('utf8')
    if (name) names.push(name)
  }
}

const hasSharePlugin = names.some(n => /capacitor.*share/i.test(n) || /SharePlugin/i.test(n))
const hasFsPlugin = names.some(n => /capacitor.*filesystem/i.test(n) || /FilesystemPlugin/i.test(n))
const shareAssets = names.filter(n => /assets\/public\/assets\/share-.*\.js$/.test(n))
const previewAssets = names.filter(n => /PreviewView-.*\.js$/.test(n))
const profileAssets = names.filter(n => /ProfileView-.*\.js$/.test(n))

console.log('=== 原生插件 ===')
console.log('capacitor-share   :', hasSharePlugin ? 'OK' : 'MISSING')
console.log('capacitor-filesystem:', hasFsPlugin ? 'OK' : 'MISSING')
console.log('=== web 产物 ===')
console.log('share chunk :', shareAssets.join(', ') || '(none)')
console.log('PreviewView :', previewAssets.join(', ') || '(none)')
console.log('ProfileView :', profileAssets.join(', ') || '(none)')

console.log('=== 关键字符串 ===')
const keys = [
  'kizuna-card-',        // 导出文件名前缀
  'Share',               // 插件名
  'Filesystem',
  '分享图片',
  '复制文本',
  '来自「绊 KIZUNA」',
  'html-to-image',
]
const found = findStrings(buf, keys)
for (const k of Object.keys(found)) console.log(`${k} : ${found[k]}`)

console.log('=== 应有=0（安全/残留）===')
const mustZero = ['kizuna-2026-r1kk-admin', 'admin_audit_logs', 'KIZUNA_ADMIN_KEY']
for (const k of mustZero) console.log(`${k} : ${buf.indexOf(Buffer.from(k)) < 0 ? 0 : 'FOUND!'}`)
