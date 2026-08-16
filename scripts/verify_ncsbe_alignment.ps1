Param(
  [switch]$KeepTemp,
  [int[]]$Years
)

$ErrorActionPreference = 'Stop'

$elections = @(
  @{ Year = 2020; Date = '2020_11_03'; Stamp = '20201103' },
  @{ Year = 2021; Date = '2021_11_02'; Stamp = '20211102' },
  @{ Year = 2022; Date = '2022_11_08'; Stamp = '20221108' },
  @{ Year = 2023; Date = '2023_11_07'; Stamp = '20231107' },
  @{ Year = 2024; Date = '2024_11_05'; Stamp = '20241105' },
  @{ Year = 2025; Date = '2025_11_04'; Stamp = '20251104' }
)

if ($Years -and $Years.Count -gt 0) {
  $elections = $elections | Where-Object { $Years -contains [int]$_.Year }
  if (-not $elections -or $elections.Count -eq 0) {
    throw "No matching elections found for Years: $($Years -join ', ')"
  }
}

function Invoke-DownloadWithRetry([string]$url, [string]$outFile, [int]$maxAttempts = 4, [int]$timeoutSec = 180) {
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt += 1) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $outFile -TimeoutSec $timeoutSec
      return
    } catch {
      if ($attempt -eq $maxAttempts) {
        throw
      }
      Write-Warning "Download failed (attempt $attempt/$maxAttempts): $url"
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

function Get-YearTotal([object[]]$rows, [int]$year) {
  return [double](($rows | Where-Object { ([datetime]$_.election_date).Year -eq $year } | Measure-Object total_voters -Sum).Sum)
}

function Get-OfficialCountyTotal([string]$filePath, [string]$countyName) {
  $reader = [System.IO.File]::OpenText($filePath)
  try {
    $headerLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($headerLine)) {
      throw "Missing header row in $filePath"
    }

    $headers = $headerLine.Split("`t")
    $countyIndex = [Array]::IndexOf($headers, 'county_desc')
    $totalIndex = [Array]::IndexOf($headers, 'total_voters')

    if ($countyIndex -lt 0 -or $totalIndex -lt 0) {
      throw "Required columns not found in $filePath"
    }

    $total = 0.0
    while ($null -ne ($line = $reader.ReadLine())) {
      if ([string]::IsNullOrWhiteSpace($line)) {
        continue
      }

      $columns = $line.Split("`t")
      if ($columns.Count -le [Math]::Max($countyIndex, $totalIndex)) {
        continue
      }

      if ($columns[$countyIndex].Trim().ToUpperInvariant() -ne $countyName) {
        continue
      }

      $voterCount = 0.0
      if ([double]::TryParse($columns[$totalIndex], [ref]$voterCount)) {
        $total += $voterCount
      }
    }

    return $total
  } finally {
    $reader.Dispose()
  }
}

$repoRoot = Join-Path $PSScriptRoot '..'
$tmpBase = Join-Path $repoRoot 'tmp\ncsbe-verify'
$runId = [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$tmpRoot = Join-Path $tmpBase $runId
New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null

$localVoterPath = Join-Path $repoRoot 'public\data\union_voter_stats.json'
$localHistoryPath = Join-Path $repoRoot 'public\data\union_history_stats.json'

$localVoterRows = Get-Content $localVoterPath -Raw | ConvertFrom-Json
$localHistoryRows = Get-Content $localHistoryPath -Raw | ConvertFrom-Json

$hasMismatch = $false

Write-Host 'Comparing local built-in data against official NCSBE ENRS files...'

foreach ($election in $elections) {
  $yearTimer = [System.Diagnostics.Stopwatch]::StartNew()
  $year = [int]$election.Year
  $baseUrl = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/$($election.Date)"
  Write-Host "Processing $year ($($election.Date))..."

  $workDir = Join-Path $tmpRoot $election.Date
  New-Item -ItemType Directory -Path $workDir | Out-Null

  $voterZip = Join-Path $workDir "voter_stats_$($election.Stamp).zip"
  $historyZip = Join-Path $workDir "history_stats_$($election.Stamp).zip"

  Write-Host "  - Downloading voter stats zip"
  Invoke-DownloadWithRetry -url "$baseUrl/voter_stats_$($election.Stamp).zip" -outFile $voterZip
  Write-Host "  - Downloading history stats zip"
  Invoke-DownloadWithRetry -url "$baseUrl/history_stats_$($election.Stamp).zip" -outFile $historyZip

  $voterExtract = Join-Path $workDir 'voter'
  $historyExtract = Join-Path $workDir 'history'
  Write-Host "  - Extracting voter stats"
  Expand-Archive -Path $voterZip -DestinationPath $voterExtract -Force
  Write-Host "  - Extracting history stats"
  Expand-Archive -Path $historyZip -DestinationPath $historyExtract -Force

  $voterFile = (Get-ChildItem -Path $voterExtract -Filter '*.txt' -File | Select-Object -First 1).FullName
  $historyFile = (Get-ChildItem -Path $historyExtract -Filter '*.txt' -File | Select-Object -First 1).FullName

  if ([string]::IsNullOrWhiteSpace($voterFile) -or [string]::IsNullOrWhiteSpace($historyFile)) {
    throw "Missing extracted .txt files for $year in $workDir"
  }

  Write-Host "  - Summing UNION county totals"
  $officialReg = Get-OfficialCountyTotal -filePath $voterFile -countyName 'UNION'
  $officialBallots = Get-OfficialCountyTotal -filePath $historyFile -countyName 'UNION'
  $officialTurnout = if ($officialReg -gt 0) { (100 * $officialBallots / $officialReg) } else { 0 }

  $localReg = Get-YearTotal -rows $localVoterRows -year $year
  $localBallots = Get-YearTotal -rows $localHistoryRows -year $year
  $localTurnout = if ($localReg -gt 0) { (100 * $localBallots / $localReg) } else { 0 }

  $regDiff = [math]::Round($localReg - $officialReg, 6)
  $ballotDiff = [math]::Round($localBallots - $officialBallots, 6)
  $turnoutDiff = [math]::Round($localTurnout - $officialTurnout, 8)

  if ($regDiff -ne 0 -or $ballotDiff -ne 0 -or $turnoutDiff -ne 0) {
    $hasMismatch = $true
    Write-Host "[FAIL] $year reg_diff=$regDiff ballot_diff=$ballotDiff turnout_diff=$turnoutDiff"
  } else {
    Write-Host "[OK]   $year turnout=$([math]::Round($localTurnout, 6))%"
  }

  $yearTimer.Stop()
  Write-Host "  - Completed $year in $([math]::Round($yearTimer.Elapsed.TotalSeconds, 1))s"
}

if (-not $KeepTemp -and (Test-Path $tmpRoot)) {
  try {
    Remove-Item $tmpRoot -Recurse -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not remove temp directory: $tmpRoot"
  }
}

if ($hasMismatch) {
  throw 'Local built-in data does not match official NCSBE ENRS totals for at least one election year.'
}

Write-Host 'Alignment check passed: local built-in data matches official NCSBE ENRS totals for all configured years.'