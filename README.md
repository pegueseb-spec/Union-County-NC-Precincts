<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Union County Voter Intelligence Dashboard

This project is a Vite + React dashboard for analyzing Union County, NC voter registration, turnout history, and precinct-level patterns from NCSBE source files.

Developed by JBPTV Consultancy Group. This implementation is designed as a reusable template for expansion across all 100 North Carolina counties.

## What It Does

- Loads built-in Union County precinct election data directly in app memory
- Filters records to Union County precincts
- Computes registration, ballot, turnout, and density summaries
- Computes year-over-year trend deltas for turnout and CVAP conversion
- Displays precinct-level stats and a choropleth map
- Highlights top-quartile opportunity precincts using a weighted score model
- Lets organizers tune opportunity-score weights directly in the map controls
- Shows data quality and provenance indicators (parse success, coverage, freshness)
- Includes a scenario planner to estimate added ballots from turnout-lift assumptions
- Exports scenario projections as CSV for field planning handoff
- Provides a one-click planning bundle CSV combining summary and scenario rows
- Includes an assumptions block in planning bundle exports (filters, turnout lift, timestamp)
- Adds a one-click Copy Assumptions action for briefing notes and chat handoffs
- Exports the filtered dashboard view as CSV

## Run Locally

Prerequisites: Node.js 20+

1. Install dependencies:
   `npm install`
2. Start the development server:
   `npm run dev`
3. Open the local URL shown by Vite

## Quality Checks

1. Run TypeScript validation:
   `npm run lint`
2. Run the smoke tests:
   `npm run test:run`
3. Build the production bundle:
   `npm run build`
4. Run the end-to-end share readiness preflight:
   `npm run release:preflight`
5. After deploy, open the hosted app and print the latest deploy run details:
   `npm run release:postdeploy`
   - Uses `gh` when available
   - Falls back to GitHub API when `gh` is not installed
   - Optional auth for API fallback: set `GITHUB_TOKEN` or `GH_TOKEN`

## Deployment

This repo now includes a GitHub Pages workflow at `.github/workflows/deploy.yml`.

To enable deployment:

1. Push the repository to GitHub.
2. In GitHub, open Settings > Pages.
3. Set the source to `GitHub Actions`.
4. Push to `main` or run the workflow manually.

The Vite base path is configured to use relative asset URLs, so the app can be hosted from a repository subpath without changing code.

## Release Checklist

The share-readiness checklist is documented in `RELEASE.md`.
You can also open the GitHub issue template at `.github/ISSUE_TEMPLATE/release-checklist.md` for a trackable publish runbook.

## Tutorial

The detailed usage and interpretation tutorial is available in `TUTORIAL.md`.

## Security

- Vulnerability handling and disclosure guidance: `SECURITY.md`
- CI security automation includes dependency review, scheduled npm audit checks, and CodeQL analysis via GitHub Actions

## Data Inputs

- Built-in dataset currently auto-loads voter and history rows from local JSON assets for Union County precinct analysis.
- CVAP starts empty by default and is populated when you upload a CVAP file.
- Uploads are optional and replace the in-memory dataset for the corresponding data type when you provide files.

Upload diagnostics:
- CVAP upload summary includes parsed, usable, dropped, and matched-to-analysis row counts
- If rows are dropped or unmatched, use the in-app `Export CVAP Issue Rows CSV` button

Accepted CVAP columns (aliases supported):
- Precinct: precinct_abbrv, precinct, precinct_name, precinct_code, precinct_id
- Year (optional): year, election_year, cvap_year, analysis_year
- CVAP total: cvap_total, cvap, total_cvap, citizen_voting_age_population
- County (optional): county_desc, county, county_name, county_nam

Template file:
- public/data/cvap-template.csv

Built-in source files:
- public/data/union_voter_stats.json
- public/data/union_history_stats.json
- public/data/demo-voter.csv (optional sample)
- public/data/demo-history.csv (optional sample)
- public/data/demo-cvap.csv (optional sample)
- The upload screen provides a `Reload Built-In Dataset` action to restore these defaults in memory

## Notes

- The precinct map is now served from the vendored local GeoJSON asset at `public/data/union-county-precincts.geojson`.
- Production builds on locked-down Windows environments may fail if Rollup native binaries are blocked by local application control policy.

## Security Hardening

- The app uses a restrictive browser-side Content Security Policy in `index.html` appropriate for a static GitHub Pages deployment.
- File uploads are limited to `.txt` and `.csv` with a 20 MB client-side size guard.
- Built-in asset fetches use request timeouts and validate expected JSON array/object shapes before processing.
- CSV exports use sanitized filenames to avoid unsafe characters in generated downloads.
