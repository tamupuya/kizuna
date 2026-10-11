// verify-apk-css.cjs — 核验 APK 内 RadarRoomView 的 CSS 是否含红/灰按钮色
const fs = require('fs');
const zlib = require('zlib');

const apk = process.argv[2] || 'android/app/build/outputs/apk/debug/app-debug.apk';
const buf = fs.readFileSync(apk);

let eocd = -1;
for (let i = buf.length - 22; i >= 0; i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
const cdCount = buf.readUInt16LE(eocd + 10);
let cdOff = buf.readUInt32LE(eocd + 16);
const entries = [];
for (let n = 0; n < cdCount; n++) {
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

function extract(e) {
  const off = e.localOff;
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const ds = off + 30 + nameLen + extraLen;
  const comp = buf.slice(ds, ds + e.compSize);
  return e.method === 8 ? zlib.inflateRawSync(comp) : comp;
}

const targets = entries.filter(e => /RadarRoomView.*\.css$/.test(e.name));
console.log(`APK: ${buf.length} bytes`);
console.log(`RadarRoomView CSS entries: ${targets.length}`);
for (const t of targets) {
  const c = extract(t).toString('utf8');
  console.log(`\n--- ${t.name} (${c.length} chars) ---`);
  console.log(`${c.includes('c44545') ? '✓' : '✗'} 红色确认 #c44545`);
  console.log(`${c.includes('e8e6e1') ? '✓' : '✗'} 灰色取消 #e8e6e1`);
  console.log(`${c.includes('a83535') ? '✓' : '✗'} 按压态 #a83535`);
  console.log(`${c.includes('.modal-btn-confirm') ? '✓' : '✗'} 规则 .modal-btn-confirm 存在`);
}
