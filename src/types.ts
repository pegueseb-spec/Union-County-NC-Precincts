export interface VoterRecord {
  county_desc: string;
  precinct_abbrv: string;
  age?: string;
  party_cd: string;
  race_code: string;
  ethnic_code: string;
  sex_code: string;
  total_voters: number;
}

export interface HistoryRecord {
  county_desc: string;
  precinct_abbrv: string;
  voting_method?: string;
  race_code: string;
  sex_code: string;
  party_cd: string;
  election_date: string; // Used to derive year
  total_voters?: number; // Some history files are aggregated
}

export interface CVAPRecord {
  year: number;
  precinct_abbrv: string;
  cvap_total: number;
}

export interface PrecinctStats {
  year: number;
  precinct: string;
  
  // Registration
  regByRace: Record<string, number>;
  regByParty: Record<string, number>;
  regByGender: Record<string, number>;
  totalReg: number;

  // Ballots
  ballotsByRace: Record<string, number>;
  ballotsByParty: Record<string, number>;
  ballotsByGender: Record<string, number>;
  totalBallots: number;

  // Turnout
  turnoutOverall: number;
  turnoutByRace: Record<string, number>;
  turnoutByParty: Record<string, number>;
  turnoutByGender: Record<string, number>;

  // CVAP
  cvapTotal: number;
  registrationShareOfCvap: number;
  ballotShareOfCvap: number;

  // Trends
  turnoutDeltaYoY: number | null;
  registrationShareOfCvapDeltaYoY: number | null;
  ballotShareOfCvapDeltaYoY: number | null;
  trendLabel: 'Improving' | 'Declining' | 'Flat' | 'N/A';

  // Density
  densityByRace: Record<string, number>;
}
