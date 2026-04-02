$ErrorActionPreference = 'Stop'

Write-Host '[1/5] Installing dependencies (npm ci)...' -ForegroundColor Cyan
npm ci

Write-Host '[2/5] Type-checking (npm run lint)...' -ForegroundColor Cyan
npm run lint

Write-Host '[3/5] Running smoke tests (npm run test:run)...' -ForegroundColor Cyan
npm run test:run

Write-Host '[4/5] Building production bundle (npm run build)...' -ForegroundColor Cyan
npm run build

Write-Host '[5/5] Running dependency audit (npm audit --omit=dev)...' -ForegroundColor Cyan
npm audit --omit=dev

Write-Host 'Release preflight completed successfully.' -ForegroundColor Green
