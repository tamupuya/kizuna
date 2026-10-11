// 检查 dist 和 android 资源中 TabBar / RadarRoomsView 的实际编译状态
const fs = require('fs');
const path = require('path');

const distDir = 'D:/deepseekharness/datachange/kizuna/dist';
const androidAssets = 'D:/deepseekharness/datachange/kizuna/android/app/src/main/assets/public';

function checkDir(dir) {
  if (!fs.existsSync(dir)) { console.log('NOT_EXIST:', dir); return; }
  const indexJs = fs.readdirSync(dir + '/assets').filter(f => f.startsWith('index-') && f.endsWith('.js'));
  if (!indexJs.length) { console.log('NO_INDEX_JS in', dir); return; }
  const content = fs.readFileSync(dir + '/assets/' + indexJs[0], 'utf8');
  console.log('\n=== ' + dir + '/assets/' + indexJs[0] + ' ===');
  console.log('  size:', content.length);
  console.log('  "zhonggu" count:', (content.match(/zhonggu/g) || []).length);
  console.log('  "同窗会" count:', (content.match(/同窗会/g) || []).length);
  console.log('  "/radar\\"" count:', (content.match(/"\/radar"/g) || []).length);
  console.log('  "/home/radar-rooms" count:', (content.match(/\/home\/radar-rooms/g) || []).length);
  console.log('  "/home/expos" count:', (content.match(/\/home\/expos/g) || []).length);
  console.log('  "RadarRoomsView" count:', (content.match(/RadarRoomsView/g) || []).length);
  console.log('  "ExposView" count:', (content.match(/ExposView/g) || []).length);
}

checkDir(distDir);
checkDir(androidAssets);