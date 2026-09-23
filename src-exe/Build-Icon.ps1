# Converts the checked-in artwork into a valid PNG-backed .ico.
# Windows supports PNG frames in ICO files since Vista; this keeps the icon
# sharp in the taskbar, window switcher and Explorer without extra tooling.

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$imagePath = Join-Path $here 'Assets\RustFix.jpg'
$icoPath = Join-Path $here 'Assets\RustFix.ico'

if (-not (Test-Path $imagePath)) {
    throw "RustFix.jpg не найден: $imagePath"
}

Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile($imagePath)
$bitmap = New-Object System.Drawing.Bitmap(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($source, 0, 0, 256, 256)
$pngStream = New-Object System.IO.MemoryStream
$bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $pngStream.ToArray()
$graphics.Dispose()
$bitmap.Dispose()
$source.Dispose()
$pngStream.Dispose()
$stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.BinaryWriter($stream)

try {
    # ICONDIR: reserved=0, type=1, count=1
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]1)

    # ICONDIRENTRY: zero means 256px. PNG data follows after 22 bytes.
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([Byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$png.Length)
    $writer.Write([UInt32]22)
    $writer.Write($png)
}
finally {
    $writer.Dispose()
    $stream.Dispose()
}