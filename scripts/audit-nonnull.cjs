// audit-nonnull.cjs — 扫描 currentUserId! / currentUser! 非空断言在未登录时的崩溃风险
const fs = require('fs');
const path = require('path');

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!f.startsWith('_') && !f.startsWith('.')) walk(p, out); }
    else if (/\.(vue|ts)$/.test(f)) out.push(p);
  }
  return out;
}

const files = walk('src');
let total = 0;
for (const p of files) {
  const c = fs.readFileSync(p, 'utf8');
  const lines = c.split(/\n/);
  lines.forEach((ln, i) => {
    if (/currentUserId!|currentUser!\.|\.currentUser!\./.test(ln) && !ln.trim().startsWith('//')) {
      total++;
      console.log(`${p.replace(/\\/g,'/').replace('src/','')}:${i+1}: ${ln.trim()}`);
    }
  });
}
console.log('');
console.log(`非空断言总数: ${total}`);
