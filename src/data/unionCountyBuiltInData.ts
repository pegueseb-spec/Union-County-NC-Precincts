// --- Built-in data metadata --------------------------------------------------
// The actual data is served as static JSON from public/data/.
// See scripts/refresh_union_county_builtin_data.ps1 to regenerate.
// Asset URLs are derived from ACTIVE_COUNTY so this file stays in sync
// automatically when the county configuration changes.
import { ACTIVE_COUNTY } from '../config/countyConfig';

export const BUILT_IN_DATA_METADATA = {
  generatedAtUtc: '2026-04-02T19:01:30Z',
  source: 'NCSBE ENRS official files',
  electionsIncluded: ACTIVE_COUNTY.availableYears,
  cvapIncluded: false,
  voterStatsUrl: ACTIVE_COUNTY.voterStatsUrl,
  historyStatsUrl: ACTIVE_COUNTY.historyStatsUrl,
  sourceUrls: [
    'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2020_11_03/',
    'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2021_11_02/',
    'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2022_11_08/',
    'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2023_11_07/',
    'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/',
    'https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2025_11_04/',
  ],
} as const;
