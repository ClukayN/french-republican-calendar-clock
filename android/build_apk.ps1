# -*- coding: utf-8 -*-
<#
  法国共和历 · Android 打包脚本

  不依赖 Gradle / Android Studio，直接用 SDK 里的 aapt2 / d8 / apksigner：
    aapt2 compile + link  →  javac  →  d8  →  塞入 classes.dex  →  zipalign  →  apksigner

  用法：
    .\build_apk.ps1            打包
    .\build_apk.ps1 -Install   打包并用 adb 装到已连接设备
#>
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Quiet,
  [string]$SdkRoot = '',
  [string]$VersionName = '1.0.0',
  [int]$VersionCode = 1
)

$ErrorActionPreference = 'Stop'

$root   = $PSScriptRoot
$src    = Join-Path $root 'src'

# SDK：命令行 -SdkRoot > RC_SDK > ANDROID_SDK_ROOT > ANDROID_HOME > 仓库内 toolchain
if (-not $SdkRoot) {
  foreach ($cand in @($env:RC_SDK, $env:ANDROID_SDK_ROOT, $env:ANDROID_HOME, (Join-Path $root 'toolchain\sdk'))) {
    if ($cand -and (Test-Path (Join-Path $cand 'build-tools'))) { $SdkRoot = $cand; break }
  }
}
if (-not $SdkRoot) { throw '找不到 Android SDK：用 -SdkRoot 指定，或设 ANDROID_SDK_ROOT' }
$sdk = (Resolve-Path $SdkRoot).Path

# JDK：JAVA_HOME > 仓库内 toolchain
$jdk = $env:JAVA_HOME
if (-not $jdk -or -not (Test-Path (Join-Path $jdk 'bin\javac.exe'))) {
  $jdk = Join-Path $root 'toolchain\jdk\jdk17.0.21_0'
}
if (-not (Test-Path (Join-Path $jdk 'bin\javac.exe'))) { throw "找不到 JDK 17：$jdk" }
$bld    = Join-Path $root 'build'
$outDir = Join-Path $root 'dist'

$bt     = Join-Path $sdk 'build-tools\34.0.0'
$androidJar = Join-Path $sdk 'platforms\android-34\android.jar'
$aapt2  = Join-Path $bt 'aapt2.exe'
$zipalign = Join-Path $bt 'zipalign.exe'
$apksigner = Join-Path $bt 'lib\apksigner.jar'
$adb    = Join-Path $sdk 'platform-tools\adb.exe'
$javaHome = $jdk

$wwwSrc = (Resolve-Path (Join-Path $root '..\src')).Path
$wwwMobile = Join-Path $wwwSrc 'www-mobile'
$wwwDesktop = Join-Path $wwwSrc 'www'

$pybin = $env:PYBIN
if (-not $pybin -or -not (Test-Path $pybin)) {
  $cmd = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($cmd) { $pybin = $cmd.Source }
}
if (-not $pybin -or -not (Test-Path $pybin)) {
  $fallback = 'C:\Users\ryoru\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
  if (Test-Path $fallback) { $pybin = $fallback }
}
if (-not $pybin -or -not (Test-Path $pybin)) { throw '找不到 python：用 PYBIN 指定' }

function Invoke-Native {
  param([string]$Exe, [string[]]$ArgList, [string]$What)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & $Exe @ArgList 2>&1 | Out-String
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) {
    Write-Host $out
    throw "$What 失败（exit $code）"
  }
  return $out
}
function Step($msg) {
  if (-not $Quiet) { Write-Host "  $msg" }
}

$env:JAVA_HOME = $javaHome
$env:Path = (Join-Path $javaHome 'bin') + ';' + $env:Path

Step '准备目录 ...'
foreach ($p in @($bld, $outDir)) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}
$assets = Join-Path $bld 'assets\www'
$genDir = Join-Path $bld 'gen'
$clsDir = Join-Path $bld 'classes'
$dexDir = Join-Path $bld 'dex'
foreach ($p in @($assets, $genDir, $clsDir, $dexDir)) {
  if (Test-Path $p) { Remove-Item $p -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}

Step '汇集网页资源 ...'
Copy-Item (Join-Path $wwwMobile 'index.html')  $assets -Force
Copy-Item (Join-Path $wwwMobile 'mobile.css')  $assets -Force
Copy-Item (Join-Path $wwwMobile 'mobile.js')   $assets -Force
Copy-Item (Join-Path $wwwDesktop 'calendar.js') $assets -Force
Copy-Item (Join-Path $wwwDesktop 'data.js')     $assets -Force

Step '编译资源 (aapt2 compile) ...'
$resZip = Join-Path $bld 'res.zip'
if (Test-Path $resZip) { Remove-Item $resZip -Force }
Invoke-Native $aapt2 @('compile', '--dir', (Join-Path $src 'res'), '-o', $resZip) 'aapt2 compile' | Out-Null

Step '链接资源 (aapt2 link) ...'
$unapk = Join-Path $bld 'app-unsigned.apk'
if (Test-Path $unapk) { Remove-Item $unapk -Force }
$linkArgs = @(
  'link', '-o', $unapk,
  '-I', $androidJar,
  '--manifest', (Join-Path $src 'AndroidManifest.xml'),
  '-R', $resZip,
  '--java', $genDir,
  '-A', (Join-Path $bld 'assets'),
  '--min-sdk-version', '24',
  '--target-sdk-version', '34',
  '--version-code', "$VersionCode",
  '--version-name', $VersionName,
  '--auto-add-overlay'
)
Invoke-Native $aapt2 $linkArgs 'aapt2 link' | Out-Null

Step '编译 Java (javac) ...'
$javaFiles = @(Get-ChildItem (Join-Path $src 'java') -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$javaFiles += @(Get-ChildItem $genDir -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$javacArgs = @('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-nowarn',
  '-Xlint:-options', '-Xlint:-deprecation',
  '-bootclasspath', $androidJar, '-d', $clsDir) + $javaFiles
Invoke-Native 'javac' $javacArgs 'javac' | Out-Null

Step '转 dex (d8) ...'
$classFiles = @(Get-ChildItem $clsDir -Recurse -Filter *.class | ForEach-Object { $_.FullName })
$d8Args = @('--lib', $androidJar, '--min-api', '24', '--output', $dexDir) + $classFiles
Invoke-Native (Join-Path $bt 'd8.bat') $d8Args 'd8' | Out-Null

Step '塞入 classes.dex ...'
$dexFile = Join-Path $dexDir 'classes.dex'
if (-not (Test-Path $dexFile)) { throw "没有生成 classes.dex" }
$dexed = Join-Path $bld 'app-dexed.apk'
if (Test-Path $dexed) { Remove-Item $dexed -Force }
Invoke-Native $pybin @((Join-Path $root 'tools\add_dex.py'), $unapk, $dexFile, $dexed) 'add_dex' | Out-Null

Step '对齐 (zipalign) ...'
$aligned = Join-Path $bld 'app-aligned.apk'
if (Test-Path $aligned) { Remove-Item $aligned -Force }
Invoke-Native $zipalign @('-f', '-p', '4', $dexed, $aligned) 'zipalign' | Out-Null

Step '签名 (apksigner) ...'
$ksAlias = if ($env:RC_KS_ALIAS) { $env:RC_KS_ALIAS } else { 'republicancalendar' }
$ksPass  = if ($env:RC_KS_PASS)  { $env:RC_KS_PASS }  else { 'republicancalendar' }
$ks = Join-Path $bld 'release.keystore'
if ($env:RC_KEYSTORE_B64) {
  # CI：签名密钥以 base64 存在 Secrets 里，构建时还原
  [IO.File]::WriteAllBytes($ks, [Convert]::FromBase64String($env:RC_KEYSTORE_B64))
}
if (-not (Test-Path $ks)) {
  $ktArgs = @('-genkeypair', '-keystore', $ks,
    '-alias', $ksAlias,
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', $ksPass, '-keypass', $ksPass,
    '-dname', 'CN=French Republican Calendar, O=ClukayN, C=CN')
  Invoke-Native 'keytool' $ktArgs 'keytool' | Out-Null
}
# apksigner 是 JVM 程序，在非中文系统的 runner 上 sun.jnu.encoding 不是 UTF-8，
# 直接把中文输出路径交给它会报 java.io.IOException: Bad pathname —— 先签成 ASCII 名再改名。
$final = Join-Path $outDir '法国共和历.apk'
$signedTmp = Join-Path $bld 'app-signed.apk'
if (Test-Path $signedTmp) { Remove-Item $signedTmp -Force }
$signArgs = @('-jar', $apksigner, 'sign',
  '--ks', $ks,
  '--ks-key-alias', $ksAlias,
  '--ks-pass', "pass:$ksPass",
  '--key-pass', "pass:$ksPass",
  '--out', $signedTmp, $aligned)
Invoke-Native 'java' $signArgs 'apksigner' | Out-Null

Step '校验签名 ...'
Invoke-Native 'java' @('-jar', $apksigner, 'verify', '--print-certs', $signedTmp) 'apksigner verify' | ForEach-Object { if (-not $Quiet) { Write-Host $_ } }

if (Test-Path $final) { Remove-Item $final -Force }
Move-Item $signedTmp $final -Force

$size = (Get-Item $final).Length
$hash = (Get-FileHash $final -Algorithm SHA256).Hash.Substring(0, 16)

Write-Host ''
Write-Host "  输出：$final"
Write-Host ("  大小：{0:N0} 字节（{1:N1} KB）" -f $size, ($size / 1KB))
Write-Host "  SHA256(前16)：$hash"

if ($Install) {
  Step '安装到设备 ...'
  & $adb install -r $final
}
