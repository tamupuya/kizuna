// 验证 APK 内 assets 是新版
const fs = require('fs');
const { execSync } = require('child_process');
const apk = 'C:/Users/19096/Desktop/kizuna/kizuna-v0.9.19-radar-room-stay.apk';

// 用 aapt 或 unzip 提取 APK 内的 index-*.js 看一下（不依赖 aapt）
// 用 PowerShell 的 Expand-Archive 不行（APK是zip但可能有特殊）
// 改用 adm-zip 不行（没装）。用 node 的 stream + 简单 zip 解析
// 简化：直接用 unzip 命令（Git Bash 通常自带）
try {
  const out = execSync(`unzip -p "${apk}" assets/public/assets/index-*.js`, { encoding: 'utf8' });
  console.log('index-*.js size:', out.length);
  console.log('  "同窗会" count:', (out.match(/同窗会/g) || []).length);
  console.log('  "中谷店" count:', (out.match(/中谷店/g) || []).length);
  console.log('  "/home/radar-rooms" count:', (out.match(/\/home\/radar-rooms/g) || []).length);
  console.log('  "RadarRoomsView" count:', (out.match(/RadarRoomsView/g) || []).length);
  console.log('  "ExposView" count:', (out.match(/ExposView/g) || []).length);
} catch (e) {
  console.log('FAIL:', e.message);
  // fallback: 用 node 简单 zip 读取
  console.log('Trying node jszip alternative...');
}