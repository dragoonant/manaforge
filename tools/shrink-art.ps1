# Turns the generator's PNG masters into delivery JPEGs.
#   powershell -File tools/shrink-art.ps1
# Each art/cards/<key>.png is moved to art/masters/ (gitignored) and re-encoded as
# art/cards/<key>.jpg at 560 px wide, quality 86. Run tools/write-manifest.mjs afterwards.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$cards = Join-Path $root 'art\cards'
$masters = Join-Path $root 'art\masters'
New-Item -ItemType Directory -Force $masters | Out-Null
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]86)
$n = 0
foreach ($f in Get-ChildItem $cards -Filter *.png) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $w = 560; $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose(); $img.Dispose()
  $bmp.Save((Join-Path $cards ($f.BaseName + '.jpg')), $codec, $params)
  $bmp.Dispose()
  Move-Item -Force $f.FullName (Join-Path $masters $f.Name)
  $n++
}
Write-Output "$n image(s) converted"
