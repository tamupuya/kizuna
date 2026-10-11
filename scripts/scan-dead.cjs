/**
 * scan-dead.cjs — 系统性死代码扫描（v0.10，2026-10-03）
 *
 * 判定标准：一个 .vue / .ts 文件若在【所有其他源文件 + 路由 + 入口】里
 * 都没有被 import / 动态 import / 字符串路径引用，则视为死文件。
 *
 * 输出：确认死亡（且给出证据：零引用）与仍活跃（给出引用者）两份清单。
 * 本脚本只读，不删任何东西。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

const allFiles = walk(SRC).filter(f => /\.(vue|ts|js)$/.test(f))
const targets = allFiles.filter(f => f !== SRC && !f.endsWith('main.ts'))

// 读取全部源码内容（含路由、App.vue、main.ts）
const contents = new Map()
for (const f of allFiles) contents.set(f, fs.readFileSync(f, 'utf8'))

// 补充根级入口文件
for (const extra of ['index.html', 'vite.config.ts']) {
  const p = path.join(ROOT, extra)
  if (fs.existsSync(p)) contents.set(p, fs.readFileSync(p, 'utf8'))
}

const dead = []
const alive = []

for (const target of targets) {
  const base = path.basename(target)
  const withoutExt = base.replace(/\.(vue|ts|js)$/, '')
  const referrers = []

  for (const [f, text] of contents) {
    if (f === target) continue
    // 匹配 basename（含扩展名）或 basename 无扩展名（import 写法）
    // 覆盖：import x from './X.vue'、() => import('../views/X.vue')、'X'
    const patterns = [
      new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      new RegExp(`[/'"\`]${withoutExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/'"\`]`),
    ]
    if (patterns.some(r => r.test(text))) {
      referrers.push(path.relative(ROOT, f))
    }
  }

  if (referrers.length === 0) dead.push(path.relative(ROOT, target))
  else alive.push({ file: path.relative(ROOT, target), refs: referrers.length, by: referrers.slice(0, 3) })
}

console.log('========== 死文件（零引用）==========')
if (dead.length === 0) console.log('(无)')
else dead.forEach(f => console.log('  ' + f))

console.log('\n========== 活跃文件 ==========')
alive
  .sort((a, b) => a.refs - b.refs)
  .forEach(a => console.log(`  [${a.refs}] ${a.file}  ← ${a.by.join(', ')}`))

console.log(`\n合计: ${dead.length} 死 / ${alive.length} 活跃（共扫描 ${targets.length}）`)
