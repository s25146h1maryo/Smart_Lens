Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\hr201\Desktop\Smart_Lens\public\icons\icon-512.png"
$destPath = "c:\Users\hr201\Desktop\Smart_Lens\public\icons\icon-192.png"
$width = 192
$height = 192

$srcImage = [System.Drawing.Image]::FromFile($sourcePath)
$destBitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($destBitmap)

$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$graphics.DrawImage($srcImage, 0, 0, $width, $height)

$destBitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$srcImage.Dispose()
$destBitmap.Dispose()
$graphics.Dispose()

Write-Host "Resized icon-512.png to icon-192.png"
