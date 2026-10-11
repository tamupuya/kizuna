// 验证 APK 内 assets 是新版 + 含 Supabase URL
const { execSync } = require('child_process');
const apk = 'C:/Users/19096/Desktop/kizuna/kizuna-v0.9.19.1-env.apk';
const out = execSync(`unzip -p "${apk}" assets/public/assets/index-Sfxt3bCm.js`, { encoding: 'buffer' });
const text = out.toString('utf8');
console.log('=== APK 内 index-Sfxt3bCm.js ===');
console.log('  size:', text.length);
console.log('  Supabase URL (qabhkgrsowxzzewdjkft):', text.includes('qabhkgrsowxzzewdjkft'));
console.log('  Supabase ANON_KEY prefix:', text.includes('eyJhbGciOiJIUzI1NiI'));
console.log('  RadarRoomsView:', (text.match(/RadarRoomsView/g) || []).length);
console.log('  ExposView:', (text.match(/ExposView/g) || []).length);
console.log('  "中谷店" count:', (text.match(/中谷店/g) || []).length);
console.log('  "同窗会" count:', (text.match(/同窗会/g) || []).length);
console.log('  /home/radar-rooms:', (text.match(/\/home\/radar-rooms/g) || []).length);
console.log('  /home/expos:', (text.match(/\/home\/expos/g) || []).length);
console.log('  isSupabaseConfigured():', text.includes('isSupabaseConfigured'));