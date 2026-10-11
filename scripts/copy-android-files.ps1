$src = 'D:\work\persona-card-site-v0911\android'
$dst = 'D:\deepseekharness\datachange\kizuna\android'

# 顶层 android 工程文件
$topFiles = @('build.gradle', 'capacitor.settings.gradle', 'gradle.properties', 'gradlew', 'gradlew.bat', 'settings.gradle', 'variables.gradle', '.gitignore')
foreach ($f in $topFiles) {
  $s = Join-Path $src $f
  $d = Join-Path $dst $f
  if (Test-Path $s) {
    Copy-Item $s $d -Force
    Write-Host "COPY: $f"
  }
}

# 顶层目录（不递归复制 build / .gradle）
$topDirs = @('app', 'gradle', 'capacitor-cordova-android-plugins')
foreach ($d in $topDirs) {
  $sd = Join-Path $src $d
  $dd = Join-Path $dst $d
  if (Test-Path $sd) {
    # 用 robocopy 排除 build 和 .gradle 缓存
    $robocopyArgs = @($sd, $dd, '/E', '/XD', 'build', '.gradle', '/NFL', '/NDL', '/NP', '/NJH', '/NJS')
    & robocopy @robocopyArgs | Out-Null
    Write-Host "COPY DIR: $d (skip build/.gradle)"
  }
}

Write-Host "DONE"