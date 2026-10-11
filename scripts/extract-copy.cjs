// 全量提取 .vue 中文文案：template 文本节点 + 属性 + script 字符串字面量
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['src/views', 'src/components'];

function walk(dir, cb) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, cb);
    else if (name.endsWith('.vue')) cb(p);
  }
}

const CJK = '\u4e00-\u9fa5';
const hasCJK = (s) => /[\u4e00-\u9fa5]/.test(s);

const fileData = [];
for (const d of DIRS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  walk(abs, (fp) => {
    const raw = fs.readFileSync(fp, 'utf8');
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    const lines = raw.split('\n');
    const items = [];
    let inTemplate = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;
      if (/<template>/.test(line)) inTemplate = true;
      if (/<\/template>/.test(line)) inTemplate = false;

      // 1) 属性值里的中文
      const attrRe = /(placeholder|title|aria-label|alt|label|data-tip)\s*=\s*"([^"]*[\u4e00-\u9fa5][^"]*)"/g;
      let m;
      while ((m = attrRe.exec(line))) {
        items.push({ line: ln, zone: inTemplate ? 'template' : 'script', kind: 'attr:' + m[1], text: m[2] });
      }

      // 2) template 文本节点：>中文< （允许包含 {{ }}）
      if (inTemplate) {
        const textRe = />([^<>]*[\u4e00-\u9fa5][^<>]*)</g;
        while ((m = textRe.exec(line))) {
          const t = m[1].trim();
          if (hasCJK(t)) items.push({ line: ln, zone: 'template', kind: 'text', text: t });
        }
      }

      // 3) script 字符串字面量（单引号/双引号/反引号），含中文，过滤代码标识
      if (!inTemplate) {
        const strRe = /(['"`])([^'"`\n]*[\u4e00-\u9fa5][^'"`\n]*)\1/g;
        while ((m = strRe.exec(line))) {
          const t = m[2].trim();
          if (!hasCJK(t)) continue;
          // 过滤明显非 UI 文案的（注释、import 路径）
          if (/^(from|import|\.\/|\.\.\/|@\/|http|https)/.test(t)) continue;
          items.push({ line: ln, zone: 'script', kind: 'string', text: t });
        }
      }
    }
    if (items.length) fileData.push({ file: rel, items });
  });
}

// 去重（同文件同 text 保留首次）
for (const f of fileData) {
  const seen = new Set();
  f.items = f.items.filter((it) => {
    const k = it.text;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

fs.writeFileSync(
  path.join(ROOT, 'scripts', 'copy-extract.json'),
  JSON.stringify(fileData, null, 2),
  'utf8'
);

let total = 0;
for (const f of fileData) total += f.items.length;
console.log('文件数:', fileData.length, '| 文案条目:', total);
for (const f of fileData) console.log(f.file, '->', f.items.length);
