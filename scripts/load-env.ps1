param(
  [string]$Path = '.env'
)

$resolvedPath = Resolve-Path -LiteralPath $Path -ErrorAction Stop
$lines = Get-Content -LiteralPath $resolvedPath
$loadedKeys = New-Object System.Collections.Generic.List[string]

foreach ($rawLine in $lines) {
  $line = $rawLine.Trim()
  if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
    continue
  }

  $parts = $line -split '=', 2
  if ($parts.Count -ne 2) {
    continue
  }

  $key = $parts[0].Trim()
  $value = $parts[1].Trim()

  if ([string]::IsNullOrWhiteSpace($key)) {
    continue
  }

  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    if ($value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }

  [Environment]::SetEnvironmentVariable($key, $value, 'Process')
  $loadedKeys.Add($key)
}

if ($loadedKeys.Count -eq 0) {
  Write-Host "No environment variables loaded from $($resolvedPath.Path)."
  exit 0
}

Write-Host "Loaded $($loadedKeys.Count) environment variable(s) from $($resolvedPath.Path):"
foreach ($name in $loadedKeys) {
  Write-Host "- $name"
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
  Write-Warning 'SUPABASE_ACCESS_TOKEN is empty. Add it to .env before deploy.'
} else {
  Write-Host "SUPABASE_ACCESS_TOKEN is set for this terminal session."
}
