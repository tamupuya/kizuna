const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const apk = 'C:\\Users\\19096\\Desktop\\kizuna\\kizuna-v0.9.21-zhonggu-v3.apk';
const tmpDir = 'D:/deepseekharness/datachange/kizuna/.tmp-apk-extract';

if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

// 用 powershell 解压
const ps = `Add-Type -A 'System.IO.Compression.FileSystem';[System.IO.Compression.ZipFile]::ExtractToDirectory('${apk}', '${tmpDir.replace(/\//g,'\\\\')}')`;
execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });

// 找 index-*.js 和 ZhongguView-*.js
const assetsDir = path.join(tmpDir, 'assets/public/assets');
const indexJs = fs.readdirSync(assetsDir).find(f => /^index-.*\.js$/.test(f));
const zhongguJs = fs.readdirSync(assetsDir).find(f => /^ZhongguView-.*\.js$/.test(f));

const keys = ['关注', '推荐', '服饰', '道具', '谷子', '搜索', 'ZhongguCardCompact', 'followStore', 'toggleFollow', 'follows', 'fhtK0YSd', '中谷店'];

function check(file) {
  const c = fs.readFileSync(file, 'utf8');
  console.log(`\n=== ${path.basename(file)} (size ${c.length}) ===`);
  for (const k of keys) {
    const count = (c.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    console.log(`  ${k} = ${count}`);
  }
}

check(path.join(assetsDir, indexJs));
if (zhongguJs) check(path.join(assetsDir, zhongguJs));

// 清理
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('\ndone.');