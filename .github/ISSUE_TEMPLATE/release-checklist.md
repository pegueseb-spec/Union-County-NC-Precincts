---
name: Release Checklist
about: Track share-readiness and post-deploy validation before publishing the app.
title: "Release: YYYY-MM-DD"
labels: ["release"]
assignees: []
---

## Go / No-Go

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `npm audit --omit=dev`

## Manual Smoke Checks

- [ ] Upload each file type manually
- [ ] Load demo dataset
- [ ] Open Dashboard and filter by year and precinct
- [ ] Export dashboard CSV
- [ ] Confirm precinct map renders
- [ ] Confirm turnout tooltip details render

## Deployment Checks

- [ ] GitHub Pages source is set to `GitHub Actions`
- [ ] Default branch is `main` (or workflow branch filter updated)
- [ ] `public/data/` assets exist (demo + template files)
- [ ] `public/data/union-county-precincts.geojson` exists

## Post-Deploy Live Check

- [ ] Open public GitHub Pages URL
- [ ] Repeat manual smoke checks on hosted app
- [ ] Share URL with users

## Notes

- Hosted URL:
- Workflow run link:
- Known issues / follow-ups:
