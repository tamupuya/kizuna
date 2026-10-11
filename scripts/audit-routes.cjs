// audit-routes.cjs — 检查所有路由跳转目标是否有对应路由表条目
const fs = require('fs');
const path = require('path');

const routerSrc = fs.readFileSync('src/router/index.ts', 'utf8');
const routes = new Set();
const re = /path:\s*'([^']+)'/g;
let m;
while ((m = re.exec(routerSrc))) routes.add(m[1]);

const all = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (!f.startsWith('_') && !f.startsWith('.')) walk(p);
    } else if (/\.(vue|ts)$/.test(f)) {
      const c = fs.readFileSync(p, 'utf8');
      const rr = /\.(push|replace)\(\s*['"`]([^'"`]+)['"`]/g;
      let mm;
      while ((mm = rr.exec(c))) {
        all.push({
          f: p.replace(/\\/g, '/').replace('src/', ''),
          path: mm[2],
          line: c.slice(0, mm.index).split(/\n/).length,
        });
      }
    }
  }
}
walk('src');

console.log('=== 路由表全部条目 ===');
[...routes].sort().forEach(r => console.log('  ' + r));
console.log('');
console.log('=== 所有 push/replace 字面量跳转 ===');
const bad = [];
for (const x of all) {
  if (x.path.startsWith('/') && !routes.has(x.path)) {
    // 检查是否动态段（含 :）前缀匹配
    const seg = '/' + x.path.split('/')[1];
    const hasDynamic = [...routes].some(r => r === x.path || (r.includes(':') && r.split('/').length === x.path.split('/').length));
    if (!hasDynamic) bad.push(x);
  }
  console.log(`  ${x.f}:${x.line}  ->  ${x.path}`);
}
console.log('');
console.log('=== 可能失配（无路由表精确/动态匹配） ===');
if (bad.length === 0) console.log('  (无)');
else bad.forEach(b => console.log(`  ${b.f}:${b.line}  ->  ${b.path}`));
