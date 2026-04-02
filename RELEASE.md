# Release Checklist

Use this checklist before sharing the app with users.

## Go / No-Go Checks

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

## Known Gaps

- There is smoke-test coverage, not a full end-to-end test suite.
- Hosted deployment still needs one live smoke test after the first GitHub Pages publish.