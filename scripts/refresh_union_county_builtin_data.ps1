Param()

$ErrorActionPreference = 'Stop'

function Convert-DateToIso([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return '' }
  return [DateTime]::ParseExact($value.Trim(), 'MM/dd/yyyy', $null).ToString('yyyy-MM-dd')
}

function To-Int([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { return 0 }
  return [int]($value.Trim())
}

function Download-WithRetry([string]$url, [string]$outFile, [int]$maxAttempts = 5) {
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt += 1) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $outFile
      return
    } catch {
      if ($attempt -eq $maxAttempts) {
        throw
      }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

$elections = @(
  @{ Year = 2020; Date = '2020_11_03'; Stamp = '20201103' },
  @{ Year = 2021; Date = '2021_11_02'; Stamp = '20211102' },
  @{ Year = 2022; Date = '2022_11_08'; Stamp = '20221108' },
  @{ Year = 2023; Date = '2023_11_07'; Stamp = '20231107' },
  @{ Year = 2024; Date = '2024_11_05'; Stamp = '20241105' },
  @{ Year = 2025; Date = '2025_11_04'; Stamp = '20251104' }
)

$tmpRoot = Join-Path $PSScriptRoot '..\tmp\ncsbe-official'
if (Test-Path $tmpRoot) { Remove-Item $tmpRoot -Recurse -Force }
New-Item -ItemType Directory -Path $tmpRoot | Out-Null

$voterRows = New-Object System.Collections.Generic.List[object]
$historyRows = New-Object System.Collections.Generic.List[object]

foreach ($election in $elections) {
  $dateFolder = $election.Date
  $stamp = $election.Stamp
  $year = [int]$election.Year

  $baseUrl = "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/$dateFolder"
  $workDir = Join-Path $tmpRoot $dateFolder
  New-Item -ItemType Directory -Path $workDir | Out-Null

  $voterZip = Join-Path $workDir "voter_stats_$stamp.zip"
  $historyZip = Join-Path $workDir "history_stats_$stamp.zip"

  Download-WithRetry -url "$baseUrl/voter_stats_$stamp.zip" -outFile $voterZip
  Download-WithRetry -url "$baseUrl/history_stats_$stamp.zip" -outFile $historyZip

  $voterExtract = Join-Path $workDir 'voter'
  $historyExtract = Join-Path $workDir 'history'

  Expand-Archive -Path $voterZip -DestinationPath $voterExtract -Force
  Expand-Archive -Path $historyZip -DestinationPath $historyExtract -Force

  $voterFile = (Get-ChildItem -Path $voterExtract -Filter '*.txt' -File | Select-Object -First 1).FullName
  $historyFile = (Get-ChildItem -Path $historyExtract -Filter '*.txt' -File | Select-Object -First 1).FullName

  $voterData = Import-Csv -Path $voterFile -Delimiter "`t"
  foreach ($row in $voterData) {
    if ($row.county_desc.Trim().ToUpper() -ne 'UNION') { continue }

    $voterRows.Add([pscustomobject]@{
      county_desc = 'UNION'
      precinct_abbrv = $row.precinct_abbrv.Trim()
      age = $row.age.Trim()
      party_cd = $row.party_cd.Trim()
      race_code = $row.race_code.Trim()
      ethnic_code = $row.ethnic_code.Trim()
      sex_code = $row.sex_code.Trim()
      total_voters = To-Int $row.total_voters
      election_date = Convert-DateToIso $row.election_date
      stats_type = $row.stats_type.Trim()
      update_date = Convert-DateToIso $row.update_date
    })
  }

  $historyData = Import-Csv -Path $historyFile -Delimiter "`t"
  foreach ($row in $historyData) {
    if ($row.county_desc.Trim().ToUpper() -ne 'UNION') { continue }

    $historyRows.Add([pscustomobject]@{
      county_desc = 'UNION'
      precinct_abbrv = $row.precinct_abbrv.Trim()
      age = $row.age.Trim()
      party_cd = $row.party_cd.Trim()
      race_code = $row.race_code.Trim()
      ethnic_code = $row.ethnic_code.Trim()
      sex_code = $row.sex_code.Trim()
      total_voters = To-Int $row.total_voters
      election_date = Convert-DateToIso $row.election_date
      stats_type = $row.stats_type.Trim()
      update_date = Convert-DateToIso $row.update_date
      voting_method = $row.voting_method.Trim()
      voted_party_cd = $row.voted_party_cd.Trim()
    })
  }

  Write-Host "Loaded official election data for $year ($dateFolder)."
}

# CVAP is not published by NCSBE at precinct-level election stats endpoints.
$cvapRows = @()

$generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$sources = $elections | ForEach-Object { "https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/$($_.Date)/" }

$voterJson = $voterRows | ConvertTo-Json -Depth 6
$historyJson = $historyRows | ConvertTo-Json -Depth 6
$cvapJson = $cvapRows | ConvertTo-Json -Depth 3
if ([string]::IsNullOrWhiteSpace($cvapJson)) { $cvapJson = '[]' }
$sourceJson = $sources | ConvertTo-Json -Depth 3

$content = @"
import { CVAPRecord, HistoryRecord, VoterRecord } from '../types';

// Generated from official NCSBE ENRS voter/history stats files for Union County.
// Refresh command: powershell -ExecutionPolicy Bypass -File scripts/refresh_union_county_builtin_data.ps1
export const BUILT_IN_DATA_METADATA = {
  generatedAtUtc: '$generatedAt',
  source: 'NCSBE ENRS official files',
  electionsIncluded: [2020, 2021, 2022, 2023, 2024, 2025],
  cvapIncluded: false,
  sourceUrls: $sourceJson,
} as const;

export const BUILT_IN_VOTER_DATA: VoterRecord[] = $voterJson;

export const BUILT_IN_HISTORY_DATA: HistoryRecord[] = $historyJson;

export const BUILT_IN_CVAP_DATA: CVAPRecord[] = $cvapJson;
"@

$outFile = Join-Path $PSScriptRoot '..\src\data\unionCountyBuiltInData.ts'
Set-Content -Path $outFile -Value $content -Encoding UTF8

Write-Host "Wrote $outFile"
Write-Host "Rows: voter=$($voterRows.Count), history=$($historyRows.Count), cvap=$($cvapRows.Count)"