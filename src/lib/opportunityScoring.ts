import { PrecinctStats } from '../types';

export type OpportunityScore = {
  precinct: string;
  score: number;
  turnoutGapNorm: number;
  registrationMassNorm: number;
  cvapGapNorm: number;
  declineNorm: number;
};

export type OpportunityWeights = {
  turnoutGap: number;
  registrationMass: number;
  cvapGap: number;
  recentDecline: number;
};

export const DEFAULT_OPPORTUNITY_WEIGHTS: OpportunityWeights = {
  turnoutGap: 45,
  registrationMass: 25,
  cvapGap: 20,
  recentDecline: 10,
};

const normalizeValue = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  return (value - min) / (max - min);
};

export const normalizeOpportunityWeights = (weights: OpportunityWeights): OpportunityWeights => {
  const total = weights.turnoutGap + weights.registrationMass + weights.cvapGap + weights.recentDecline;
  if (total <= 0) {
    return {
      turnoutGap: 0.25,
      registrationMass: 0.25,
      cvapGap: 0.25,
      recentDecline: 0.25,
    };
  }

  return {
    turnoutGap: weights.turnoutGap / total,
    registrationMass: weights.registrationMass / total,
    cvapGap: weights.cvapGap / total,
    recentDecline: weights.recentDecline / total,
  };
};

export const computeOpportunityScores = (
  stats: PrecinctStats[],
  weights: OpportunityWeights = DEFAULT_OPPORTUNITY_WEIGHTS,
): OpportunityScore[] => {
  if (stats.length === 0) return [];
  const normalizedWeights = normalizeOpportunityWeights(weights);

  const countyTurnout = (stats.reduce((acc, s) => acc + s.totalBallots, 0) / (stats.reduce((acc, s) => acc + s.totalReg, 0) || 1)) * 100;
  const turnoutGapValues = stats.map((s) => Math.max(0, countyTurnout - s.turnoutOverall));
  const registrationValues = stats.map((s) => s.totalReg);
  const cvapGapValues = stats.map((s) => (s.cvapTotal > 0 ? Math.max(0, 100 - s.ballotShareOfCvap) : 0));
  const declineValues = stats.map((s) => Math.max(0, -(s.turnoutDeltaYoY ?? 0)));

  const turnoutGapMin = Math.min(...turnoutGapValues);
  const turnoutGapMax = Math.max(...turnoutGapValues);
  const registrationMin = Math.min(...registrationValues);
  const registrationMax = Math.max(...registrationValues);
  const cvapGapMin = Math.min(...cvapGapValues);
  const cvapGapMax = Math.max(...cvapGapValues);
  const declineMin = Math.min(...declineValues);
  const declineMax = Math.max(...declineValues);

  return stats
    .map((s) => {
      const turnoutGapNorm = normalizeValue(Math.max(0, countyTurnout - s.turnoutOverall), turnoutGapMin, turnoutGapMax);
      const registrationMassNorm = normalizeValue(s.totalReg, registrationMin, registrationMax);
      const cvapGapNorm = normalizeValue(s.cvapTotal > 0 ? Math.max(0, 100 - s.ballotShareOfCvap) : 0, cvapGapMin, cvapGapMax);
      const declineNorm = normalizeValue(Math.max(0, -(s.turnoutDeltaYoY ?? 0)), declineMin, declineMax);
      const score = (normalizedWeights.turnoutGap * turnoutGapNorm)
        + (normalizedWeights.registrationMass * registrationMassNorm)
        + (normalizedWeights.cvapGap * cvapGapNorm)
        + (normalizedWeights.recentDecline * declineNorm);

      return {
        precinct: s.precinct,
        score,
        turnoutGapNorm,
        registrationMassNorm,
        cvapGapNorm,
        declineNorm,
      };
    })
    .sort((a, b) => b.score - a.score);
};

export const getTopQuartileOpportunityScores = (scores: OpportunityScore[]): OpportunityScore[] => {
  if (scores.length === 0) return [];
  const quartileCount = Math.max(1, Math.ceil(scores.length * 0.25));
  return scores.slice(0, quartileCount);
};
