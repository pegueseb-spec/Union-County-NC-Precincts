<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Union County Voter Intelligence Dashboard

This project is a Vite + React dashboard for analyzing Union County, NC voter registration, turnout history, and precinct-level patterns from NCSBE source files.

## What It Does

- Loads built-in Union County precinct election data directly in app memory
- Filters records to Union County precincts
- Computes registration, ballot, turnout, and density summaries
- Displays precinct-level stats and a choropleth map
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

## Data Inputs

- Built-in memory dataset includes voter, history, and CVAP rows across all Union County precinct IDs in the local map data.
- Uploads are optional and override the in-memory dataset when you provide files.

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
- public/data/demo-voter.csv
- public/data/demo-history.csv
- public/data/demo-cvap.csv
- The upload screen provides a `Reload Built-In Dataset` action to restore these defaults in memory

## Notes

- The precinct map is now served from the vendored local GeoJSON asset at `public/data/union-county-precincts.geojson`.
- Production builds on locked-down Windows environments may fail if Rollup native binaries are blocked by local application control policy.
