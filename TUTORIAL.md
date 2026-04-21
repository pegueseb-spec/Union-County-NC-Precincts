# Union County Voter Intelligence Dashboard Tutorial

This tutorial helps campaign, civic, and research teams get the strongest practical insight from the dashboard data.

## Product Context

Developer: JBPTV Consultancy Group  
Concept owner: JBPTV Consultancy Group  
Expansion vision: Scale this framework from Union County to all 100 North Carolina counties.

## Outcomes You Should Expect

- Faster identification of low-turnout opportunity precincts
- Better segmentation by party, race, and sex mix
- Repeatable weekly reporting workflow for field operations
- Shareable exports for canvassing, phones, mail, and digital teams

## Data Model Overview

The dashboard combines three datasets:

1. Voter registration file
- Primary signal: who is currently registered
- Key fields used: county, precinct, party, race, sex, total voters

2. Voter history file
- Primary signal: who actually voted
- Key fields used: county, precinct, election date, party, race, sex, total voters

3. CVAP file (optional but strongly recommended)
- Primary signal: citizen voting age population baseline
- Key fields used: precinct, cvap total, optional year, optional county

## How The Core Metrics Work

1. Total Registered
- Sum of registration counts in precinct-year slice

2. Total Ballots
- Sum of history counts in precinct-year slice

3. Turnout %
- Formula: ballots / registered x 100

4. Registered / CVAP %
- Formula: registered / cvap x 100
- Useful for understanding registration saturation

5. Ballots / CVAP %
- Formula: ballots / cvap x 100
- Useful for understanding effective mobilization of total eligible citizens

6. Year-over-year deltas
- The dashboard now calculates turnout, Registered/CVAP, and Ballots/CVAP deltas versus the prior year for each precinct
- Positive values indicate improvement; negative values indicate slippage

## Recommended Operating Workflow

### Step 1: Baseline countywide scan

1. Go to Dashboard
2. Set the election year
3. Keep precinct filter at All
4. Note countywide turnout and registration volume

### Step 2: Geo discovery with map

1. Hover map precincts to inspect turnout and volume
2. Click a precinct to lock it as active and auto-zoom into the area
3. Use Opportunity Mode to emphasize high-registration, lower-turnout target precincts
4. Use Prev precinct / Next precinct buttons or keyboard arrows to scan quickly
5. Use the side panel to inspect detailed breakdowns
6. Press Escape to clear selection and reset map focus
7. Use Clear precinct selection to return to countywide mode
8. Use Reset map view if pan/zoom drifts too far

### Step 3: Identify field priority precincts

Prioritize precincts where:

- Registration is high but turnout is low
- Ballots/CVAP is meaningfully below neighboring precincts
- One segment (party or race) has unusually weak turnout relative to registration share

Also use Opportunity Mode on the map:

- Opportunity score now combines turnout gap, registration mass, CVAP gap, and recent decline
- Highlighted precincts represent the top quartile of score values for the selected year
- Darker orange indicates higher relative priority among highlighted precincts
- You can adjust score weights in-map to match strategy (for example: persuasion-heavy vs turnout-rescue)
- Use Reset score weights to restore the default balanced model

### Step 4: Build action categories

For each priority precinct, assign one dominant strategy:

1. Registration growth
- Use when Registered/CVAP is low

2. Persuasion
- Use when registration is healthy but turnout remains low

3. GOTV chase
- Use when likely support exists but conversion is inconsistent

4. Election day logistics
- Use when turnout volatility suggests access or process friction

### Step 5: Export and share

1. Export Summary CSV for countywide reporting
2. Export precinct-specific CSV from Precinct Insights
3. Attach action notes and owner assignments in your field plan

## Weekly Insight Cadence (Suggested)

1. Monday: refresh source files and load current dataset
2. Tuesday: run countywide scan and map triage
3. Wednesday: precinct-level targeting decisions
4. Thursday: field deployment and message testing
5. Friday: export report and update stakeholder summary

## Session Persistence

The dashboard now remembers key controls between sessions:

1. Election year
2. Precinct filter
3. Scenario turnout lift
4. Opportunity action filter

## Scenario Planning

Use the Scenario Planner section to estimate impact before committing resources:

1. Choose year and precinct scope using dashboard filters
2. Set turnout lift assumption (0% to 20%)
3. Review projected ballots and estimated additional ballots
4. Use Top Estimated Precinct Gains to prioritize deployment
5. Export Scenario CSV to share modeled precinct-level gains with field and analytics teams
6. Export Planning Bundle CSV for a single file that includes both dashboard summary and scenario projection rows
7. Review the assumptions block at the top of the planning bundle before sharing downstream
8. Use Copy Assumptions to paste the exact scenario context into briefs, tickets, or team chat
9. Confirm the inline success/error notice after copy/export actions before sharing outputs
11. Compare conservative/base/aggressive confidence bands to size low-risk and high-upside plans

## Opportunity Targets Panel

Use Opportunity Targets (Top Quartile) to operationalize map highlights quickly:

1. Review ranked precinct score order for the selected year
2. Compare driver intensity columns (turnout gap, registration mass, CVAP gap, recent decline)
3. Use Focus Precinct to jump directly into detailed precinct diagnostics
4. Use Export Targets CSV to distribute ranked target lists across field teams
5. Use Recommended Action to assign first-pass field strategy per target precinct
6. Apply Action Filter to export a strategy-specific target pack (for example only GOTV Chase)
7. Use Select all visible, checkboxes, and Export Selected CSV to distribute only assigned target subsets
8. Use Copy Selected Precincts to paste assignment-ready target lists into chat, tickets, or field briefs

## Focused Field Packet

When you have selected a specific precinct:

1. Use Export Field Packet in Precinct Insights
2. Share the packet CSV with organizers as a single precinct brief
3. The packet includes assumptions, core metrics, projected ballots, and recommended action

Notes:

- Projection caps ballots at registered voters in each precinct
- Scenario values are directional planning aids, not forecasts with confidence intervals

## Data Quality Checks

Before relying on outputs:

1. Verify upload summaries show usable rows > 0
2. If CVAP match is low, export CVAP issue rows and clean inputs
3. Confirm precinct naming consistency (leading zeros, abbreviations)
4. Verify selected year aligns with intended election cycle
5. Check Data Quality and Provenance panel before sharing insights:
- Voter/History/CVAP parse success rates should be stable and high
- Precinct-year coverage should be close to full expected coverage
- CVAP match rate should be monitored before drawing CVAP conclusions
- Built-in data freshness timestamp should be acceptable for your reporting cycle
- Review Data Quality Alerts for threshold breaches before distributing field recommendations

## Interpretation Tips For Better Decisions

1. Do not evaluate turnout in isolation
- Always compare turnout with both registration and CVAP context

2. Watch trend direction, not only single values
- Rising registration with flat turnout can signal weak mobilization

3. Compare peers
- Similar precincts with different turnout usually reveal actionable operational differences

4. Treat small counts carefully
- Very small precinct totals can create noisy percentages

## Expansion Playbook For 100 Counties

To replicate statewide:

1. Swap in county-specific voter/history/CVAP and precinct GeoJSON
2. Keep the same normalization and metric framework
3. Validate precinct key mapping per county before launch
4. Reuse this UX pattern for operator consistency
5. Maintain a county-by-county release checklist and QA signoff

## Attribution

This tool was developed by JBPTV Consultancy Group and is positioned as a reusable intelligence template for county-level expansion across North Carolina.
