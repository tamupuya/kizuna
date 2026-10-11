Add-Type -A 'System.IO.Compression.FileSystem'
$apk = "C:\Users\19096\Desktop\kizuna\kizuna-v0.9.21-zhonggu-v3.apk"
$z = [System.IO.Compression.ZipFile]::OpenRead($apk)
$e = $z.GetEntry("assets/public/assets/index-fhtK0YSd.js")
$s = New-Object System.IO.StreamReader($e.Open())
$c = $s.ReadToEnd()
$s.Close()
$z.Dispose()

$keys = @("关注", "推荐", "服饰", "道具", "谷子", "搜索", "ZhongguCardCompact", "followStore", "toggleFollow", "follows", "fhtK0YSd", "中谷店")
foreach ($k in $keys) {
    $count = ([regex]::Matches($c, [regex]::Escape($k))).Count
    Write-Host ("$k = $count")
}

# ZhongguView chunk
$z2 = [System.IO.Compression.ZipFile]::OpenRead($apk)
foreach ($entry in $z2.Entries) {
    if ($entry.FullName -match "ZhongguView-.*\.js$") {
        $s2 = New-Object System.IO.StreamReader($entry.Open())
        $cc = $s2.ReadToEnd()
        $s2.Close()
        Write-Host ("ZHONGGU CHUNK: $($entry.FullName) size $($entry.Length)")
        foreach ($k in $keys) {
            $count = ([regex]::Matches($cc, [regex]::Escape($k))).Count
            Write-Host ("  $k = $count")
        }
    }
}
$z2.Dispose()