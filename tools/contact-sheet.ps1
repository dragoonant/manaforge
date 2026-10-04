# Builds contact sheets for reviewing illustrations.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/contact-sheet.ps1 -Name ninjas -Keys "key1,key2,..."
# Reads art/cards/<key>.png (or .jpg / .webp is skipped) and writes scratch/sheet-<Name>-<n>.jpg, 24 per sheet.
param([string]$Name = 'all', [string]$Keys = '')
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'art\cards'
$out = Join-Path $root 'scratch'
$list = @()
if ($Keys -ne '') { foreach ($k in $Keys.Split(',')) { foreach ($ext in '.png', '.jpg') { $p = Join-Path $dir ($k.Trim() + $ext); if (Test-Path $p) { $list += Get-Item $p; break } } } }
else { $list = Get-ChildItem $dir | Where-Object { $_.Extension -in '.png', '.jpg' } | Sort-Object Name }
$cols = 8; $tw = 190; $th = 268; $page = 24
for ($p = 0; $p * $page -lt $list.Count; $p++) {
  $set = $list | Select-Object -Skip ($p * $page) -First $page
  $rows = [math]::Ceiling($set.Count / $cols)
  $bmp = New-Object System.Drawing.Bitmap ($cols * $tw), ($rows * ($th + 16))
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::Black)
  $font = New-Object System.Drawing.Font 'Segoe UI', 8
  $i = 0
  foreach ($f in $set) {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $x = ($i % $cols) * $tw; $y = [math]::Floor($i / $cols) * ($th + 16)
    $g.DrawImage($img, $x, $y, $tw, $th); $g.DrawString($f.BaseName, $font, [System.Drawing.Brushes]::White, $x + 2, $y + $th)
    $img.Dispose(); $i++
  }
  $g.Dispose()
  $bmp.Save((Join-Path $out "sheet-$Name-$p.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg); $bmp.Dispose()
}
Write-Output "$($list.Count) image(s) on $([math]::Ceiling($list.Count / $page)) sheet(s): scratch/sheet-$Name-*.jpg"
