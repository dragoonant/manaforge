# Builds the art-direction audition grid: one row per card, one column per style variant.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/audition-sheet.ps1 [-Out scratch/audition-sheet.jpg]
param([string]$Out = 'scratch/audition-sheet.jpg')
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'scratch\audition'
$plan = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'prompts.json') | ConvertFrom-Json
$variants = $plan | ForEach-Object { $_.variant } | Select-Object -Unique
$cards = $plan | ForEach-Object { $_.cardId } | Select-Object -Unique
$tw = 300; $th = 438; $head = 34; $lw = 0
$bmp = New-Object System.Drawing.Bitmap ($variants.Count * $tw), ($cards.Count * $th + $head)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::Black)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$font = New-Object System.Drawing.Font 'Segoe UI', 13, ([System.Drawing.FontStyle]::Bold)
for ($c = 0; $c -lt $variants.Count; $c++) {
  $v = $variants[$c]; $name = ($plan | Where-Object { $_.variant -eq $v } | Select-Object -First 1).variantName
  $g.DrawString("$v  $name", $font, [System.Drawing.Brushes]::Gold, ($c * $tw + 6), 6)
  for ($r = 0; $r -lt $cards.Count; $r++) {
    $p = Join-Path $dir ("$v-" + $cards[$r] + '.png')
    if (Test-Path $p) { $img = [System.Drawing.Image]::FromFile($p); $g.DrawImage($img, ($c * $tw + 2), ($head + $r * $th + 2), ($tw - 4), ($th - 4)); $img.Dispose() }
  }
}
$g.Dispose()
$bmp.Save((Join-Path $root $Out), [System.Drawing.Imaging.ImageFormat]::Jpeg); $bmp.Dispose()
Write-Output "audition grid: $Out ($($cards.Count) cards x $($variants.Count) variants)"
