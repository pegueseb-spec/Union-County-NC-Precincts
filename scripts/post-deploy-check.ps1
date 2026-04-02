param(
  [string]$Repo = '',
  [string]$PagesUrl = ''
)

$ErrorActionPreference = 'Stop'

function Get-RepoFromGitRemote {
  $remote = (git remote get-url origin).Trim()

  if ($remote -match 'github\.com[:/](?<owner>[^/]+)/(?<name>[^/]+?)(\.git)?$') {
    return "{0}/{1}" -f $Matches.owner, $Matches.name
  }

  throw "Unable to parse GitHub owner/repo from remote URL: $remote"
}

if (-not $Repo) {
  $Repo = Get-RepoFromGitRemote
}

$owner, $name = $Repo.Split('/', 2)

if (-not $PagesUrl) {
  if ($name -eq "$owner.github.io") {
    $PagesUrl = "https://$name/"
  }
  else {
    $PagesUrl = "https://$owner.github.io/$name/"
  }
}

$workflowPath = "https://github.com/$Repo/actions/workflows/deploy.yml"

function Write-RunSummary {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Run,
    [Parameter(Mandatory = $true)]
    [string]$Source
  )

  $runId = if ($Run.databaseId) { $Run.databaseId } elseif ($Run.id) { $Run.id } else { 'unknown' }
  $runUrl = if ($Run.url) { $Run.url } elseif ($Run.html_url) { $Run.html_url } else { 'n/a' }
  $branch = if ($Run.headBranch) { $Run.headBranch } elseif ($Run.head_branch) { $Run.head_branch } else { 'unknown' }
  $createdAt = if ($Run.createdAt) { $Run.createdAt } elseif ($Run.created_at) { $Run.created_at } else { 'unknown' }

  Write-Host ("Latest deploy run ({0}): #{1}" -f $Source, $runId) -ForegroundColor Green
  Write-Host ("Status: {0}" -f $Run.status)
  Write-Host ("Conclusion: {0}" -f $Run.conclusion)
  Write-Host ("Branch: {0}" -f $branch)
  Write-Host ("Created: {0}" -f $createdAt)
  Write-Host ("Run URL: {0}" -f $runUrl) -ForegroundColor Green
}

Write-Host "Pages URL: $PagesUrl" -ForegroundColor Cyan
Write-Host "Deploy workflow: $workflowPath" -ForegroundColor Cyan

try {
  Start-Process $PagesUrl | Out-Null
  Write-Host 'Opened Pages URL in your default browser.' -ForegroundColor Green
}
catch {
  Write-Warning "Could not open browser automatically: $($_.Exception.Message)"
}

$gh = Get-Command gh -ErrorAction SilentlyContinue
Write-Host 'Fetching latest deploy workflow run...' -ForegroundColor Cyan
if ($gh) {
  try {
    $runJson = gh run list --repo $Repo --workflow deploy.yml --limit 1 --json databaseId,url,status,conclusion,headBranch,createdAt | Out-String
    $runs = $runJson | ConvertFrom-Json

    if ($runs -and $runs.Count -gt 0) {
      Write-RunSummary -Run $runs[0] -Source 'gh'
      return
    }
  }
  catch {
    Write-Warning "gh lookup failed, falling back to GitHub API: $($_.Exception.Message)"
  }
}
else {
  Write-Host 'GitHub CLI (gh) not found, using GitHub API fallback.' -ForegroundColor Yellow
}

$apiUrl = "https://api.github.com/repos/$Repo/actions/workflows/deploy.yml/runs?per_page=1"
$headers = @{
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent' = 'union-county-release-postdeploy'
}

$token = ''
if ($env:GITHUB_TOKEN) {
  $token = $env:GITHUB_TOKEN
}
elseif ($env:GH_TOKEN) {
  $token = $env:GH_TOKEN
}

if ($token) {
  $headers.Authorization = "Bearer $token"
}
else {
  Write-Host 'No GitHub token found (GITHUB_TOKEN/GH_TOKEN). Using unauthenticated API request.' -ForegroundColor Yellow
}

try {
  $response = Invoke-RestMethod -Method Get -Uri $apiUrl -Headers $headers
  $runs = $response.workflow_runs

  if (-not $runs -or $runs.Count -eq 0) {
    Write-Warning 'No deploy workflow runs were found yet.'
    return
  }

  Write-RunSummary -Run $runs[0] -Source 'api'
}
catch {
  $statusCode = $null
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $statusCode = [int]$_.Exception.Response.StatusCode
  }

  if ($statusCode -eq 404) {
    Write-Warning 'GitHub API returned 404. This is common for private repos without authentication.'
    Write-Warning 'Set GITHUB_TOKEN or GH_TOKEN with repo access and run again.'
  }
  elseif ($statusCode -eq 403) {
    Write-Warning 'GitHub API returned 403 (rate limit or insufficient token scope).'
    Write-Warning 'Set GITHUB_TOKEN or GH_TOKEN and run again.'
  }
  else {
    Write-Warning "Failed to fetch latest deploy run from API: $($_.Exception.Message)"
    Write-Warning 'Set GITHUB_TOKEN or GH_TOKEN and run again if needed.'
  }
}
