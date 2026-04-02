# Release Checklist

Use this checklist before sharing the app with users.

## Go / No-Go Checks

- Optional one-command preflight: `npm run release:preflight`
- Install dependencies with `npm ci`.
- Run `npm run lint` and confirm it passes.
- Run `npm run test:run` and confirm it passes.
- Run `npm run build` and confirm the production bundle is created.
- Load the app in a browser and verify these flows:
  - Upload each file type manually.
  - Load the demo dataset.
  - Open Dashboard, filter by year and precinct, and export CSV.
  - Confirm the precinct map renders and the tooltip shows turnout details.
- Confirm the latest dependency audit is clean with `npm audit --omit=dev`.

## Operational Checks

- Verify GitHub Pages is configured to deploy from GitHub Actions.
- Verify the repository default branch is `main` or update the workflow branch filter.
- Confirm demo and template assets exist in `public/data/`.
- Confirm the local GeoJSON asset exists at `public/data/union-county-precincts.geojson`.
- Optional tracking: create a release issue using `.github/ISSUE_TEMPLATE/release-checklist.md`.
- Optional helper: run `npm run release:postdeploy` to open the Pages URL and print the latest deploy run.
- If `gh` is unavailable, `release:postdeploy` uses GitHub API fallback. Set `GITHUB_TOKEN` or `GH_TOKEN` to avoid API rate limits.
- Verify upload validation rejects non-CSV/TXT files and oversized files.
- Verify the app shell still loads correctly with the CSP defined in `index.html`.
- Verify `.github/workflows/security.yml` is enabled and running successfully on the default branch.
- Verify Dependabot is enabled for npm and GitHub Actions updates.
- Review `SECURITY.md` whenever reporting or maintainer contacts change.

## Known Gaps

- There is smoke-test coverage, not a full end-to-end test suite.
- Hosted deployment still needs one live smoke test after the first GitHub Pages publish.