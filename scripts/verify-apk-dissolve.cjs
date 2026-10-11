// verify-apk-dissolve.cjs — 核验 APK 内解散弹窗改动是否真的打进包
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const apk = process.argv[2] || 'android/app/build/outputs/apk/debug/app-debug.apk';
const buf = fs.readFileSync(apk);

// 极简 zip 解析：定位 central directory，读 entry 名与偏移
function readZipEntries(buf) {
  // 找 EOCD
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD not found');
  const cdCount = buf.readUInt16LE(eocd + 10);
  let cdOff = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(cdOff) !== 0x02014b50) break;
    const method = buf.readUInt16LE(cdOff + 10);
    const compSize = buf.readUInt32LE(cdOff + 20);
    const nameLen = buf.readUInt16LE(cdOff + 28);
    const extraLen = buf.readUInt16LE(cdOff + 30);
    const commentLen = buf.readUInt16LE(cdOff + 32);
    const localOff = buf.readUInt32LE(cdOff + 42);
    const name = buf.slice(cdOff + 46, cdOff + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compSize, localOff });
    cdOff += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function extract(buf, e) {
  const off = e.localOff;
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const comp = buf.slice(dataStart, dataStart + e.compSize);
  if (e.method === 0) return comp;
  if (e.method === 8) return zlib.inflateRawSync(comp);
  throw new Error('unsupported method ' + e.method);
}

const entries = readZipEntries(buf);
const targets = entries.filter(e => /assets\/public\/assets\/RadarRoomView-.*\.js$/.test(e.name));
console.log(`APK: ${apk} (${buf.length} bytes)`);
console.log(`RadarRoomView chunks: ${targets.length}`);

for (const t of targets) {
  const content = extract(buf, t).toString('utf8');
  console.log(`\n--- ${t.name} (${content.length} chars) ---`);
  const checks = {
    '文案: 你确认要解散同窗会吗': '你确认要解散同窗会吗',
    '文案: 房间还有其他': '房间还有其他',
    '红色确认按钮 #c44545': 'c44545',
    '灰色取消按钮 #e8e6e1': 'e8e6e1',
    '按压态 #a83535': 'a83535',
  };
  for (const [label, k] of Object.entries(checks)) {
    console.log(`${content.includes(k) ? '✓' : '✗'} ${label}`);
  }
  // 关键反查：旧逻辑「只有房主一人直接解散」应已消失
  const hasOldDirect = /otherCount\s*<=\s*0/.test(content) || /only.*host.*direct/i.test(content);
  console.log(`${hasOldDirect ? '✗ 旧逻辑残留' : '✓ 旧「独自则直接解散」逻辑已移除'}`);
}
