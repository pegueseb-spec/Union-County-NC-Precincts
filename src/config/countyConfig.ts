/**
 * County configuration abstraction.
 *
 * To add a new county, duplicate the shape below with the new county's values
 * and swap the import in the consuming files to the new county's config.
 * All county-specific strings, data asset paths, and display labels are
 * centralized here — no other file should hard-code county names.
 */

export interface CountyConfig {
  /** Raw county filter string matched against the NCSBE "county_desc" field (upper-case). */
  countyCode: string;
  /** Human-readable display name used in UI labels and export filenames. */
  displayName: string;
  /** Short display name for compact contexts (e.g. table headers). */
  shortName: string;
  /** Public-asset-relative URL for the voter stats JSON. */
  voterStatsUrl: string;
  /** Public-asset-relative URL for the history stats JSON. */
  historyStatsUrl: string;
  /** Public-asset-relative URL for the precinct boundary GeoJSON. */
  geoJsonUrl: string;
  /** Prefix used when generating export CSV filenames. */
  exportFilePrefix: string;
  /** Election years available in the built-in dataset (ascending). */
  availableYears: readonly number[];
}

export const UNION_COUNTY_CONFIG: CountyConfig = {
  countyCode: 'UNION',
  displayName: 'Union County',
  shortName: 'Union',
  voterStatsUrl: 'data/union_voter_stats.json',
  historyStatsUrl: 'data/union_history_stats.json',
  geoJsonUrl: 'data/union-county-precincts.geojson',
  exportFilePrefix: 'Union_County',
  availableYears: [2020, 2021, 2022, 2023, 2024, 2025],
} as const;

/**
 * The county configuration active for this deployment.
 * Swap this export to target a different county without touching any other file.
 */
export const ACTIVE_COUNTY: CountyConfig = UNION_COUNTY_CONFIG;
