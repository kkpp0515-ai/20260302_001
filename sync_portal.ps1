$portalFile = "index.html"
$startTag = "<!-- TOOL_CARDS_START -->"
$endTag = "<!-- TOOL_CARDS_END -->"

# Scan directories for metadata.json
$toolDirs = Get-ChildItem -Directory | Where-Object { Test-Path (Join-Path $_.FullName "metadata.json") }

$toolCards = ""

foreach ($dir in $toolDirs) {
    $metadataPath = Join-Path $dir.FullName "metadata.json"
    $metadata = Get-Content $metadataPath -Raw -Encoding UTF8 | ConvertFrom-Json
    
    $title = $metadata.title
    $icon = $metadata.icon
    $desc = $metadata.description
    $status = if ($metadata.status) { "<div class='status-badge'>$($metadata.status)</div>" } else { "" }
    $href = "./$($dir.Name)/"
    
    $toolCards += @"

        <a href="$href" class="tool-card">
            <span class="tool-icon">$icon</span>
            <div class="tool-title">$title</div>
            $status
            <p class="tool-desc">$desc</p>
        </a>
"@
}

# Read index.html
$html = Get-Content $portalFile -Raw

# Replace content between tags
$pattern = "(?s)$startTag.*?$endTag"
$replacement = "$startTag$toolCards`r`n        $endTag"
$newHtml = [regex]::Replace($html, $pattern, $replacement)

# Write back to index.html
Set-Content $portalFile $newHtml -Encoding UTF8

Write-Host "Portal updated successfully with $($toolDirs.Count) tools." -ForegroundColor Green
