$source = "WestFamilyTree"
$target = "."

# Lista på filer/mappar som INTE ska flyttas om de redan finns i roten
$skip = @("node_modules", ".git", "package.json", "package-lock.json", "yarn.lock")

# Gå igenom alla filer och mappar i WestFamilyTree/WestFamilyTree
Get-ChildItem -Path $source -Force | ForEach-Object {
    $name = $_.Name
    $targetPath = Join-Path $target $name
    if ($skip -contains $name -and (Test-Path $targetPath)) {
        Write-Host "Hoppar över $name (finns redan i roten eller ska inte flyttas)"
    } elseif (Test-Path $targetPath) {
        Write-Host "Hoppar över $name (dubblett i roten)"
    } else {
        Write-Host "Flyttar $name"
        Move-Item -Path $_.FullName -Destination $target
    }
}

# Ta bort tomma mappen om allt är flyttat
if ((Get-ChildItem -Path $source -Force | Measure-Object).Count -eq 0) {
    Remove-Item $source -Force
    Write-Host "Tog bort tomma mappen $source"
}