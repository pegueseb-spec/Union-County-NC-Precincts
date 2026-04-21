# Multi-County Expansion Guide

This document provides step-by-step instructions for deploying the Voter Intelligence Dashboard to additional North Carolina counties.

## Architecture Overview

The application is built on a **county-agnostic core** with a **pluggable county configuration layer**. All county-specific values (data asset paths, display names, GeoJSON boundaries) are defined in a single configuration file:

```
src/config/countyConfig.ts
```

This design allows you to:
- Deploy to a new county in minutes without modifying application logic
- Maintain identical UI/UX across all counties
- Re-use all components, utilities, and business logic
- Version-control multiple county configs in parallel

## Step-by-Step Expansion

### 1. Prepare County Data Assets

Before adding a configuration, you need:

1. **Voter Stats JSON** (`county_voter_stats.json`)
   - Generated from NCSBE ENRS official files for your county
   - Schema: Array of voter record summaries by precinct and demographic
   - Location: `public/data/[county]_voter_stats.json`
   - Script: See `scripts/refresh_union_county_builtin_data.ps1` for generation pattern

2. **History Stats JSON** (`county_history_stats.json`)
   - Election history by precinct and election cycle
   - Schema: Array of history records with election dates and vote totals
   - Location: `public/data/[county]_history_stats.json`
   - Script: Adapt the voter stats refresh script for history data

3. **Precinct Boundary GeoJSON** (`county-precincts.geojson`)
   - GeoJSON FeatureCollection with precinct boundaries
   - Feature properties must include: `prec_id`, `PREC_NAME`, or `PRECINCT`
   - Location: `public/data/[county]-precincts.geojson`
   - Source: NCSBE precinct shapefiles (convert to GeoJSON via ogr2ogr or Mapshaper)

### 2. Create County Configuration

Add a new constant to `src/config/countyConfig.ts`:

```typescript
export const ORANGE_COUNTY_CONFIG: CountyConfig = {
  countyCode: 'ORANGE',                                    // Upper-case NCSBE county filter code
  displayName: 'Orange County',                            // UI display name
  shortName: 'Orange',                                     // Compact form (headers, exports)
  voterStatsUrl: 'data/orange_voter_stats.json',          // Relative public/ path
  historyStatsUrl: 'data/orange_history_stats.json',      // Relative public/ path
  geoJsonUrl: 'data/orange-county-precincts.geojson',    // Relative public/ path
  exportFilePrefix: 'Orange_County',                       // CSV export filename prefix
  availableYears: [2020, 2021, 2022, 2023, 2024, 2025],  // Election years in dataset
} as const;
```

### 3. Activate County Configuration

Update the `ACTIVE_COUNTY` export in `src/config/countyConfig.ts`:

```typescript
/**
 * The county configuration active for this deployment.
 * Swap this export to target a different county without touching any other file.
 */
export const ACTIVE_COUNTY: CountyConfig = ORANGE_COUNTY_CONFIG;
```

That's it. The rest of the application will automatically use the new county's assets and display names.

### 4. Verify Data Integrity

Before deploying:

1. **Check voter stats schema**
   ```bash
   npm run check-data -- --file public/data/orange_voter_stats.json
   ```

2. **Validate GeoJSON**
   ```bash
   npm run validate-geojson -- --file public/data/orange-county-precincts.geojson
   ```

3. **Run full test suite**
   ```bash
   npm run test
   npm run lint
   ```

### 5. Test Locally

```bash
npm run dev
# Open http://localhost:5173
# Verify:
# - County name appears in header and UI labels
# - Auto-load built-in data loads without errors
# - Precinct list matches your county's boundaries
# - Exports use correct filename prefix
```

### 6. Build and Deploy

```bash
npm run build
# Deploy dist/ folder to your hosting (Vercel, GitHub Pages, etc.)
```

## Multi-County Deployment (Advanced)

To run **multiple counties simultaneously** (e.g., statewide dashboard with county selector):

1. **Export multiple configs** in `src/config/countyConfig.ts`:
   ```typescript
   export const COUNTIES = {
     union: UNION_COUNTY_CONFIG,
     orange: ORANGE_COUNTY_CONFIG,
     durham: DURHAM_COUNTY_CONFIG,
   } as const;
   ```

2. **Add county selector UI** in `src/App.tsx`:
   ```typescript
   const [activeCounty, setActiveCounty] = useState<CountyConfig>(COUNTIES.union);
   // Pass activeCounty to child components instead of ACTIVE_COUNTY
   ```

3. **Update ChoroplethMap** to use dynamic `geoJsonUrl` prop (already implemented).

4. **Document county-specific endpoints** if using API-backed data instead of static JSON.

## Troubleshooting

### "County not found in GeoJSON"
- Verify `prec_id`, `PREC_NAME`, or `PRECINCT` properties exist in GeoJSON features
- Ensure voter stats precinct IDs match GeoJSON property values (case-sensitive normalization applied)

### "Missing county_desc field"
- Your voter/history CSVs must include a `county_desc` column matching NCSBE naming convention
- Manually add if missing: `county_desc = "COUNTY_NAME"` for all rows

### "Built-in data files are not in the expected array format"
- Verify JSON files are arrays `[{...}, {...}]`, not objects `{...}`
- Check for trailing commas or syntax errors (use `jq` or online JSON validator)

### "Asset fetch timeout"
- Verify URLs in `countyConfig.ts` exactly match file paths in `public/data/`
- Check network tab in browser DevTools for 404 errors

## Data Refresh Cycle

To keep data current:

1. **Monthly**: Run NCSBE ENRS data refresh script
   ```bash
   .\scripts\refresh_union_county_builtin_data.ps1 -county ORANGE
   ```

2. **Quarterly**: Update GeoJSON if precinct boundaries change

3. **Yearly**: Verify election years in `availableYears` match your dataset

## License & Terms

This multi-county expansion framework is proprietary to JBPTV Consultancy Group.
Unauthorized duplication, reverse engineering, or adaptation of this system requires express written permission.

See LICENSE file for complete terms.
