const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const apk = 'C:/Users/19096/Desktop/kizuna/kizuna-v0.9.21-zhonggu-v3.apk';

// 用 PowerShell 列 zip 内文件
const ps = `Add-Type -A 'System.IO.Compression.FileSystem';$z=[System.IO.Compression.ZipFile]::OpenRead('${apk.replace(/\//g,'\\\\')}');$z.Entries|Where-Object{$_.FullName -match 'assets/public/assets/index-.*\\.js$'} | ForEach-Object { Write-Host ('FILE:'+$_.FullName+' SIZE:'+$_.Length) };$z.Dispose()`;
console.log('--- listing assets ---');
try {
  const out = execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g,' ')}"`, { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.log('list err:', e.message);
}

// 验证关键字
const buf = fs.readFileSync(apk);
const md5 = crypto.createHash('md5').update(buf).digest('hex');
console.log('APK MD5:', md5);
console.log('APK size:', buf.length);