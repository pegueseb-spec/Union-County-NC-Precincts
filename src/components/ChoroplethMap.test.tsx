import { describe, expect, it } from 'vitest';
import type { PrecinctStats } from '../types';
import { computeOpportunityScores } from './ChoroplethMap';

const makeStat = (overrides: Partial<PrecinctStats>): PrecinctStats => ({
  year: 2024,
  precinct: '01',
  regByRace: { W: 100 },
  regByParty: { REP: 100 },
  regByGender: { M: 60, F: 40 },
  totalReg: 100,
  ballotsByRace: { W: 50 },
  ballotsByParty: { REP: 50 },
  ballotsByGender: { M: 30, F: 20 },
  totalBallots: 50,
  turnoutOverall: 50,
  turnoutByRace: { W: 50 },
  turnoutByParty: { REP: 50 },
  turnoutByGender: { M: 50, F: 50 },
  cvapTotal: 200,
  registrationShareOfCvap: 50,
  ballotShareOfCvap: 25,
  turnoutDeltaYoY: 0,
  registrationShareOfCvapDeltaYoY: 0,
  ballotShareOfCvapDeltaYoY: 0,
  trendLabel: 'Flat',
  densityByRace: { W: 100 },
  ...overrides,
});

describe('computeOpportunityScores', () => {
  it('ranks high-registration low-turnout precincts above stronger performers', () => {
    const stats: PrecinctStats[] = [
      makeStat({ precinct: 'A', totalReg: 900, totalBallots: 270, turnoutOverall: 30, ballotShareOfCvap: 18, turnoutDeltaYoY: -6 }),
      makeStat({ precinct: 'B', totalReg: 600, totalBallots: 330, turnoutOverall: 55, ballotShareOfCvap: 34, turnoutDeltaYoY: 1 }),
      makeStat({ precinct: 'C', totalReg: 250, totalBallots: 200, turnoutOverall: 80, ballotShareOfCvap: 60, turnoutDeltaYoY: 5 }),
      makeStat({ precinct: 'D', totalReg: 700, totalBallots: 343, turnoutOverall: 49, ballotShareOfCvap: 27, turnoutDeltaYoY: -2 }),
    ];

    const scores = computeOpportunityScores(stats);

    expect(scores[0].precinct).toBe('A');
    expect(scores[scores.length - 1].precinct).toBe('C');
    expect(scores[0].score).toBeGreaterThan(scores[1].score);
  });

  it('returns empty list when no stats are provided', () => {
    expect(computeOpportunityScores([])).toEqual([]);
  });
});
