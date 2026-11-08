# =========================================================================
#  构建「法国共和历」桌面程序
#  用 .NET Framework 自带的 csc.exe 编译（无需安装 SDK），
#  把网页界面与 WebView2Loader.dll 作为内嵌资源打进单个 exe。
# =========================================================================
param(
  [switch]$Run,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$www  = Join-Path $root 'src\www'
$app  = Join-Path $root 'src\app'
$web  = Join-Path $root 'vendor\webview2'
$dist = Join-Path $root 'dist'
$bld  = Join-Path $root 'build'
$assets = Join-Path $root 'assets'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { throw "找不到 csc.exe：$csc" }

$core = Join-Path $web 'Microsoft.Web.WebView2.Core.dll'
$wf   = Join-Path $web 'Microsoft.Web.WebView2.WinForms.dll'
$ldr  = Join-Path $web 'WebView2Loader.dll'
$ico  = Join-Path $assets 'app.ico'
foreach ($f in @($core, $wf, $ldr, $ico)) {
  if (-not (Test-Path $f)) { throw "缺少依赖文件：$f" }
}

New-Item -ItemType Directory -Force -Path $dist, $bld | Out-Null

$exe = Join-Path $bld 'RepublicanCalendar.exe'
if (Test-Path $exe) { Remove-Item $exe -Force }

$sources = @(
  (Join-Path $app 'Program.cs'),
  (Join-Path $app 'MainForm.cs')
)

$cscArgs = @(
  '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/warn:4',
  '/utf8output', '/debug-',
  ('/out:' + $exe),
  ('/win32manifest:' + (Join-Path $app 'app.manifest')),
  ('/win32icon:' + $ico),
  '/reference:System.dll',
  '/reference:System.Core.dll',
  '/reference:System.Drawing.dll',
  '/reference:System.Windows.Forms.dll',
  ('/reference:' + $core),
  ('/reference:' + $wf),
  ('/resource:' + (Join-Path $www 'index.html') + ',www.index.html'),
  ('/resource:' + (Join-Path $www 'app.js') + ',www.app.js'),
  ('/resource:' + (Join-Path $www 'calendar.js') + ',www.calendar.js'),
  ('/resource:' + (Join-Path $www 'styles.css') + ',www.styles.css'),
  ('/resource:' + (Join-Path $www 'data.js') + ',www.data.js'),
  ('/resource:' + $core + ',lib.Microsoft.Web.WebView2.Core.dll'),
  ('/resource:' + $wf + ',lib.Microsoft.Web.WebView2.WinForms.dll'),
  ('/resource:' + $ldr + ',lib.WebView2Loader.dll'),
  ('/resource:' + $ico + ',res.app.ico')
) + $sources

if (-not $Quiet) { Write-Host "编译中 ..." -ForegroundColor Cyan }
$log = & $csc $cscArgs 2>&1
$code = $LASTEXITCODE
if ($log) { $log | ForEach-Object { Write-Host $_ } }
if ($code -ne 0) { throw "编译失败（exit $code）" }

$deliver = Join-Path $dist '法国共和历.exe'
Copy-Item $exe $deliver -Force

$len = (Get-Item $deliver).Length
$hash = (Get-FileHash $deliver -Algorithm SHA256).Hash.Substring(0, 16)
if (-not $Quiet) {
  Write-Host ''
  Write-Host "  输出：$deliver" -ForegroundColor Green
  Write-Host ('  大小：{0:N0} 字节（{1:N1} KB）' -f $len, ($len / 1KB)) -ForegroundColor Green
  Write-Host "  SHA256(前16)：$hash" -ForegroundColor DarkGray
  Write-Host ''
}

if ($Run) { Start-Process $deliver }
