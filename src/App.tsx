import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Papa, { ParseError, ParseResult } from 'papaparse';
import { 
  BarChart3, 
  FileUp, 
  FileDown, 
  Search, 
  Info, 
  Filter, 
  ChevronRight, 
  Database, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  MapPin,
  Calendar,
  Download,
  Map as MapIcon,
  type LucideIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { BUILT_IN_DATA_METADATA } from './data/unionCountyBuiltInData';
import { computeOpportunityScores, getTopQuartileOpportunityScores } from './lib/opportunityScoring';
import { CVAPRecord, HistoryRecord, PrecinctStats, VoterRecord } from './types';

const ChoroplethMap = lazy(async () => {
  const module = await import('./components/ChoroplethMap');
  return { default: module.ChoroplethMap };
});

const HowToPanel = lazy(async () => {
  const module = await import('./components/HowToPanel');
  return { default: module.HowToPanel };
});

// --- Constants ---
const UNION_COUNTY = "UNION";
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const RACE_CODES = ['W', 'B', 'A', 'I', 'M', 'O', 'P', 'U'];
const PARTY_CODES = ['REP', 'DEM', 'UNA', 'LIB', 'GRE', 'CST', 'NLB'];
const GENDER_CODES = ['M', 'F', 'U'];
const YEARLESS_CVAP = 0;
const CVAP_PRECINCT_KEYS = ['precinct_abbrv', 'precinct', 'precinct_name', 'precinct_code', 'precinctid', 'precinct_id', 'precinctabbrv'];
const CVAP_YEAR_KEYS = ['year', 'election_year', 'cvap_year', 'analysis_year'];
const CVAP_TOTAL_KEYS = ['cvap_total', 'cvap', 'citizen_voting_age_population', 'citizen voting age population', 'total_cvap'];
const COUNTY_KEYS = ['county_desc', 'county', 'county_name', 'county_nam'];
const MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024;
const FILE_UPLOAD_PATTERN = /\.(txt|csv)$/i;
const ASSET_FETCH_TIMEOUT_MS = 15000;
const getPublicAssetPath = (relativePath: string) => `${import.meta.env.BASE_URL}${relativePath.replace(/^\/+/, '')}`;

const sanitizeDownloadFilename = (value: string) => {
  const normalized = value.replace(/\.csv$/i, '').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '');
  return `${normalized || 'export'}.csv`;
};

type CsvCell = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvCell>;

const exportCsvFile = (rows: CsvRow[], filename: string) => {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', sanitizeDownloadFilename(filename));
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDeltaPoints = (value: number | null) => {
  if (value === null) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pts`;
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(1)}%`;
};

const getRecommendedActionCategory = (
  registrationShareOfCvap: number,
  turnoutOverall: number,
  turnoutDeltaYoY: number | null,
): 'Registration Growth' | 'Persuasion' | 'GOTV Chase' | 'Election Day Logistics' => {
  if (registrationShareOfCvap > 0 && registrationShareOfCvap < 60) {
    return 'Registration Growth';
  }

  if (turnoutOverall < 45) {
    return 'Persuasion';
  }

  if (turnoutDeltaYoY !== null && turnoutDeltaYoY < -3) {
    return 'Election Day Logistics';
  }

  return 'GOTV Chase';
};

const validateUploadFile = (file: File) => {
  if (!FILE_UPLOAD_PATTERN.test(file.name)) {
    return 'Only .txt and .csv files are accepted.';
  }

  if (file.size <= 0) {
    return 'The selected file is empty.';
  }

  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return `The selected file exceeds the ${Math.round(MAX_UPLOAD_FILE_BYTES / (1024 * 1024))} MB upload limit.`;
  }

  return null;
};

const fetchJsonAsset = async <T,>(relativePath: string): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ASSET_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(getPublicAssetPath(relativePath), {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load ${relativePath} (HTTP ${response.status})`);
    }

    return await response.json() as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Timed out loading ${relativePath}.`);
    }

    throw err instanceof Error ? err : new Error(`Failed to load ${relativePath}.`);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const getMatchedHeaders = (headers: string[], candidateKeys: string[]) => {
  const normalizedCandidates = candidateKeys.map(normalizeKey);
  return headers.filter((header) => normalizedCandidates.includes(normalizeKey(header)));
};

const getRowValue = (row: Record<string, unknown>, candidateKeys: string[]) => {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeKey(key), value] as const);
  for (const candidateKey of candidateKeys) {
    const match = normalizedEntries.find(([key]) => key === normalizeKey(candidateKey));
    if (match) return match[1];
  }
  return undefined;
};

const normalizePrecinct = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const precinct = String(value).trim().toUpperCase().replace(/^PRECINCT\s+/, '');
  return precinct || null;
};

const normalizeCode = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const code = String(value).trim().toUpperCase();
  return code || null;
};

const normalizeNumericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeYearValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return YEARLESS_CVAP;

  const match = value.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : YEARLESS_CVAP;
};

const getTrendLabel = (delta: number | null): 'Improving' | 'Declining' | 'Flat' | 'N/A' => {
  if (delta === null) return 'N/A';
  if (delta > 1) return 'Improving';
  if (delta < -1) return 'Declining';
  return 'Flat';
};

const isUnionCountyRow = (row: Record<string, unknown>) => {
  const county = getRowValue(row, COUNTY_KEYS);
  if (county === null || county === undefined || String(county).trim() === '') {
    return true;
  }

  return String(county).toUpperCase().includes(UNION_COUNTY);
};

const normalizeCvapRecord = (row: Record<string, unknown>): CVAPRecord | null => {
  if (!isUnionCountyRow(row)) return null;

  const precinct = normalizePrecinct(getRowValue(row, CVAP_PRECINCT_KEYS));
  const cvapTotal = normalizeNumericValue(getRowValue(row, CVAP_TOTAL_KEYS));
  const year = normalizeYearValue(getRowValue(row, CVAP_YEAR_KEYS));

  if (!precinct || cvapTotal === null) {
    return null;
  }

  return {
    year,
    precinct_abbrv: precinct,
    cvap_total: cvapTotal,
  };
};

const normalizeVoterRecord = (row: Record<string, unknown>): VoterRecord | null => {
  if (!isUnionCountyRow(row)) return null;

  const precinct = normalizePrecinct(getRowValue(row, ['precinct_abbrv', 'precinct']));
  const party = normalizeCode(getRowValue(row, ['party_cd', 'party']));
  const race = normalizeCode(getRowValue(row, ['race_code', 'race']));
  const sex = normalizeCode(getRowValue(row, ['sex_code', 'sex', 'gender']));
  const totalVoters = normalizeNumericValue(getRowValue(row, ['total_voters', 'voters', 'count'])) ?? 0;

  if (!precinct || !party || !race || !sex) return null;

  return {
    county_desc: String(getRowValue(row, COUNTY_KEYS) || UNION_COUNTY),
    precinct_abbrv: precinct,
    age: getRowValue(row, ['age']) ? String(getRowValue(row, ['age'])) : undefined,
    party_cd: party,
    race_code: race,
    ethnic_code: getRowValue(row, ['ethnic_code']) ? String(getRowValue(row, ['ethnic_code'])) : '',
    sex_code: sex,
    total_voters: totalVoters,
  };
};

const normalizeHistoryRecord = (row: Record<string, unknown>): HistoryRecord | null => {
  if (!isUnionCountyRow(row)) return null;

  const precinct = normalizePrecinct(getRowValue(row, ['precinct_abbrv', 'precinct']));
  const party = normalizeCode(getRowValue(row, ['party_cd', 'party']));
  const race = normalizeCode(getRowValue(row, ['race_code', 'race']));
  const sex = normalizeCode(getRowValue(row, ['sex_code', 'sex', 'gender']));
  const electionDateRaw = getRowValue(row, ['election_date', 'date', 'electionday']);
  const electionDate = electionDateRaw ? String(electionDateRaw) : null;
  const totalVoters = normalizeNumericValue(getRowValue(row, ['total_voters', 'voters', 'count']));

  if (!precinct || !party || !race || !sex || !electionDate) return null;

  return {
    county_desc: String(getRowValue(row, COUNTY_KEYS) || UNION_COUNTY),
    precinct_abbrv: precinct,
    voting_method: getRowValue(row, ['voting_method']) ? String(getRowValue(row, ['voting_method'])) : undefined,
    race_code: race,
    sex_code: sex,
    party_cd: party,
    election_date: electionDate,
    total_voters: totalVoters ?? undefined,
  };
};

const getVoterDropReason = (row: Record<string, unknown>) => {
  if (!isUnionCountyRow(row)) return 'Outside Union County filter';

  const precinct = normalizePrecinct(getRowValue(row, ['precinct_abbrv', 'precinct']));
  const party = normalizeCode(getRowValue(row, ['party_cd', 'party']));
  const race = normalizeCode(getRowValue(row, ['race_code', 'race']));
  const sex = normalizeCode(getRowValue(row, ['sex_code', 'sex', 'gender']));

  if (!precinct && !party && !race && !sex) return 'Missing precinct, party, race, and sex fields';
  if (!precinct) return 'Missing precinct value';
  if (!party) return 'Missing party value';
  if (!race) return 'Missing race value';
  if (!sex) return 'Missing sex/gender value';
  return 'Row could not be normalized';
};

const getHistoryDropReason = (row: Record<string, unknown>) => {
  if (!isUnionCountyRow(row)) return 'Outside Union County filter';

  const precinct = normalizePrecinct(getRowValue(row, ['precinct_abbrv', 'precinct']));
  const party = normalizeCode(getRowValue(row, ['party_cd', 'party']));
  const race = normalizeCode(getRowValue(row, ['race_code', 'race']));
  const sex = normalizeCode(getRowValue(row, ['sex_code', 'sex', 'gender']));
  const electionDateRaw = getRowValue(row, ['election_date', 'date', 'electionday']);

  if (!precinct) return 'Missing precinct value';
  if (!party) return 'Missing party value';
  if (!race) return 'Missing race value';
  if (!sex) return 'Missing sex/gender value';
  if (!electionDateRaw) return 'Missing election date';
  return 'Row could not be normalized';
};

// --- Components ---

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: LucideIcon, label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-6 py-3 font-medium transition-all relative",
      active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
    )}
  >
    <Icon size={18} />
    {label}
    {active && (
      <motion.div
        layoutId="activeTab"
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
      />
    )}
  </button>
);

const StatCard = ({ title, value, subValue, icon: Icon, color }: { title: string, value: string | number, subValue?: string, icon: LucideIcon, color: string }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
    <div className={cn("p-3 rounded-lg", color)}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      {subValue && <p className="text-sm text-gray-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

export default function App() {
  type UploadSummary = { parsedRows: number; usableRows: number; droppedRows: number };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'readme'>('upload');
  const [voterData, setVoterData] = useState<VoterRecord[]>([]);
  const [historyData, setHistoryData] = useState<HistoryRecord[]>([]);
  const [cvapData, setCvapData] = useState<CVAPRecord[]>([]);
  const [voterUploadSummary, setVoterUploadSummary] = useState<UploadSummary | null>(null);
  const [historyUploadSummary, setHistoryUploadSummary] = useState<UploadSummary | null>(null);
  const [cvapUploadSummary, setCvapUploadSummary] = useState<UploadSummary | null>(null);
  const [voterDroppedRows, setVoterDroppedRows] = useState<Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }>>([]);
  const [historyDroppedRows, setHistoryDroppedRows] = useState<Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }>>([]);
  const [cvapDroppedRows, setCvapDroppedRows] = useState<Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }>>([]);
  const [cvapHeaderValidation, setCvapHeaderValidation] = useState<{
    headers: string[];
    matchedHeaders: {
      precinct: string[];
      total: string[];
      year: string[];
      county: string[];
    };
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("ALL");
  const [scenarioTurnoutLiftPct, setScenarioTurnoutLiftPct] = useState<number>(5);
  const [scenarioNotice, setScenarioNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [opportunityActionFilter, setOpportunityActionFilter] = useState<'ALL' | 'Registration Growth' | 'Persuasion' | 'GOTV Chase' | 'Election Day Logistics'>('ALL');

  // --- Data Processing ---

  const handleFileUpload = (type: 'voter' | 'history' | 'cvap', file: File) => {
    setIsProcessing(true);
    setError(null);

    const fileValidationError = validateUploadFile(file);
    if (fileValidationError) {
      setError(`${type.toUpperCase()} upload rejected: ${fileValidationError}`);
      setIsProcessing(false);
      return;
    }

    if (type === 'voter') {
      setVoterUploadSummary(null);
      setVoterDroppedRows([]);
    } else if (type === 'history') {
      setHistoryUploadSummary(null);
      setHistoryDroppedRows([]);
    } else if (type === 'cvap') {
      setCvapUploadSummary(null);
      setCvapDroppedRows([]);
      setCvapHeaderValidation(null);
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results: ParseResult<Record<string, unknown>>) => {
        const data = results.data as Record<string, unknown>[];

        if (type === 'cvap') {
          const firstRow = data.find((row) => Object.keys(row).length > 0);
          const headers = firstRow ? Object.keys(firstRow) : [];
          setCvapHeaderValidation({
            headers,
            matchedHeaders: {
              precinct: getMatchedHeaders(headers, CVAP_PRECINCT_KEYS),
              total: getMatchedHeaders(headers, CVAP_TOTAL_KEYS),
              year: getMatchedHeaders(headers, CVAP_YEAR_KEYS),
              county: getMatchedHeaders(headers, COUNTY_KEYS),
            },
          });

          const droppedRows: Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }> = [];
          const normalizedCvap = data
            .map((row, index) => {
              const normalized = normalizeCvapRecord(row);
              if (normalized) {
                return normalized;
              }

              const precinctValue = normalizePrecinct(getRowValue(row, CVAP_PRECINCT_KEYS));
              const cvapValue = normalizeNumericValue(getRowValue(row, CVAP_TOTAL_KEYS));
              const countyMatches = isUnionCountyRow(row);

              let reason = 'Row could not be normalized';
              if (!countyMatches) reason = 'Outside Union County filter';
              else if (!precinctValue && cvapValue === null) reason = 'Missing precinct and CVAP total values';
              else if (!precinctValue) reason = 'Missing precinct value';
              else if (cvapValue === null) reason = 'Missing or invalid CVAP total value';

              droppedRows.push({
                rowNumber: index + 2,
                reason,
                row,
              });
              return null;
            })
            .filter((record): record is CVAPRecord => record !== null);

          setCvapDroppedRows(droppedRows);

          setCvapUploadSummary({
            parsedRows: data.length,
            usableRows: normalizedCvap.length,
            droppedRows: Math.max(data.length - normalizedCvap.length, 0),
          });

          if (normalizedCvap.length === 0 && data.length > 0) {
            setError('Could not detect CVAP records. Expected precinct and CVAP total columns, with an optional year column.');
            setIsProcessing(false);
            return;
          }

          setCvapData(normalizedCvap);
          setIsProcessing(false);
          return;
        }

        if (type === 'voter') {
          const droppedRows: Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }> = [];
          const normalized = data
            .map((row, index) => {
              const record = normalizeVoterRecord(row);
              if (record) return record;
              droppedRows.push({ rowNumber: index + 2, reason: getVoterDropReason(row), row });
              return null;
            })
            .filter((record): record is VoterRecord => record !== null);

          setVoterData(normalized);
          setVoterDroppedRows(droppedRows);
          setVoterUploadSummary({
            parsedRows: data.length,
            usableRows: normalized.length,
            droppedRows: Math.max(data.length - normalized.length, 0),
          });
        } else if (type === 'history') {
          const droppedRows: Array<{ rowNumber: number; reason: string; row: Record<string, unknown> }> = [];
          const normalized = data
            .map((row, index) => {
              const record = normalizeHistoryRecord(row);
              if (record) return record;
              droppedRows.push({ rowNumber: index + 2, reason: getHistoryDropReason(row), row });
              return null;
            })
            .filter((record): record is HistoryRecord => record !== null);

          setHistoryData(normalized);
          setHistoryDroppedRows(droppedRows);
          setHistoryUploadSummary({
            parsedRows: data.length,
            usableRows: normalized.length,
            droppedRows: Math.max(data.length - normalized.length, 0),
          });
        }

        setIsProcessing(false);
      },
      error: (err: Error | ParseError) => {
        setError(`Error parsing ${type} file: ${err.message}`);
        setIsProcessing(false);
      }
    });
  };

  // Derived Stats
  const processedStats = useMemo(() => {
    if (voterData.length === 0 && historyData.length === 0) return [];

    const stats: PrecinctStats[] = [];
    const cvapByPrecinctYear = new Map<string, number>();
    const cvapFallbackByPrecinct = new Map<string, number>();
    const voterByPrecinct = new Map<string, VoterRecord[]>();
    const historyByPrecinctYear = new Map<string, HistoryRecord[]>();

    voterData.forEach((record) => {
      const list = voterByPrecinct.get(record.precinct_abbrv) || [];
      list.push(record);
      voterByPrecinct.set(record.precinct_abbrv, list);
    });

    historyData.forEach((record) => {
      if (!record.election_date) return;
      const electionYear = new Date(record.election_date).getFullYear();
      if (!Number.isFinite(electionYear)) return;

      const key = `${electionYear}:${record.precinct_abbrv}`;
      const list = historyByPrecinctYear.get(key) || [];
      list.push(record);
      historyByPrecinctYear.set(key, list);
    });

    cvapData.forEach((record) => {
      const precinct = normalizePrecinct(record.precinct_abbrv);
      if (!precinct) return;

      const exactKey = `${record.year}:${precinct}`;
      cvapByPrecinctYear.set(exactKey, (cvapByPrecinctYear.get(exactKey) || 0) + record.cvap_total);

      if (record.year === YEARLESS_CVAP) {
        cvapFallbackByPrecinct.set(precinct, (cvapFallbackByPrecinct.get(precinct) || 0) + record.cvap_total);
      }
    });

    const precincts = Array.from(new Set([
      ...voterData.map(d => d.precinct_abbrv),
      ...historyData.map(d => d.precinct_abbrv)
    ])).filter(Boolean).sort();

    YEARS.forEach(year => {
      precincts.forEach(precinct => {
        const precinctReg = voterByPrecinct.get(precinct) || [];
        const precinctHistory = historyByPrecinctYear.get(`${year}:${precinct}`) || [];

        // Registration Aggregations
        const regByRace: Record<string, number> = {};
        const regByParty: Record<string, number> = {};
        const regByGender: Record<string, number> = {};
        let totalReg = 0;

        precinctReg.forEach(d => {
          const count = Number(d.total_voters) || 1;
          regByRace[d.race_code] = (regByRace[d.race_code] || 0) + count;
          regByParty[d.party_cd] = (regByParty[d.party_cd] || 0) + count;
          regByGender[d.sex_code] = (regByGender[d.sex_code] || 0) + count;
          totalReg += count;
        });

        // Ballots Aggregations
        const ballotsByRace: Record<string, number> = {};
        const ballotsByParty: Record<string, number> = {};
        const ballotsByGender: Record<string, number> = {};
        let totalBallots = 0;

        precinctHistory.forEach(d => {
          const count = Number(d.total_voters) || 1;
          ballotsByRace[d.race_code] = (ballotsByRace[d.race_code] || 0) + count;
          ballotsByParty[d.party_cd] = (ballotsByParty[d.party_cd] || 0) + count;
          ballotsByGender[d.sex_code] = (ballotsByGender[d.sex_code] || 0) + count;
          totalBallots += count;
        });

        // Turnout Calculations
        const turnoutOverall = totalReg > 0 ? (totalBallots / totalReg) * 100 : 0;
        
        const turnoutByRace: Record<string, number> = {};
        RACE_CODES.forEach(r => {
          const reg = regByRace[r] || 0;
          const cast = ballotsByRace[r] || 0;
          turnoutByRace[r] = reg > 0 ? (cast / reg) * 100 : 0;
        });

        const turnoutByParty: Record<string, number> = {};
        PARTY_CODES.forEach(p => {
          const reg = regByParty[p] || 0;
          const cast = ballotsByParty[p] || 0;
          turnoutByParty[p] = reg > 0 ? (cast / reg) * 100 : 0;
        });

        const turnoutByGender: Record<string, number> = {};
        GENDER_CODES.forEach(g => {
          const reg = regByGender[g] || 0;
          const cast = ballotsByGender[g] || 0;
          turnoutByGender[g] = reg > 0 ? (cast / reg) * 100 : 0;
        });

        const normalizedPrecinct = normalizePrecinct(precinct);
        const alternatePrecinct = normalizedPrecinct?.replace(/^0+/, '') || normalizedPrecinct;
        const exactCvap = normalizedPrecinct
          ? cvapByPrecinctYear.get(`${year}:${normalizedPrecinct}`) ?? cvapByPrecinctYear.get(`${year}:${alternatePrecinct}`)
          : undefined;
        const fallbackCvap = normalizedPrecinct
          ? cvapFallbackByPrecinct.get(normalizedPrecinct) ?? cvapFallbackByPrecinct.get(alternatePrecinct || '')
          : undefined;
        const cvapTotal = exactCvap ?? fallbackCvap ?? 0;
        const registrationShareOfCvap = cvapTotal > 0 ? (totalReg / cvapTotal) * 100 : 0;
        const ballotShareOfCvap = cvapTotal > 0 ? (totalBallots / cvapTotal) * 100 : 0;

        // Density
        const densityByRace: Record<string, number> = {};
        RACE_CODES.forEach(r => {
          densityByRace[r] = totalReg > 0 ? ((regByRace[r] || 0) / totalReg) * 100 : 0;
        });

        if (totalReg > 0 || totalBallots > 0) {
          stats.push({
            year,
            precinct,
            regByRace,
            regByParty,
            regByGender,
            totalReg,
            ballotsByRace,
            ballotsByParty,
            ballotsByGender,
            totalBallots,
            turnoutOverall,
            turnoutByRace,
            turnoutByParty,
            turnoutByGender,
            cvapTotal,
            registrationShareOfCvap,
            ballotShareOfCvap,
            turnoutDeltaYoY: null,
            registrationShareOfCvapDeltaYoY: null,
            ballotShareOfCvapDeltaYoY: null,
            trendLabel: 'N/A',
            densityByRace
          });
        }
      });
    });

    const statsByPrecinct = new Map<string, PrecinctStats[]>();
    stats.forEach((row) => {
      const list = statsByPrecinct.get(row.precinct) || [];
      list.push(row);
      statsByPrecinct.set(row.precinct, list);
    });

    statsByPrecinct.forEach((rows) => {
      const byYear = new Map(rows.map((row) => [row.year, row]));
      rows.forEach((row) => {
        const prior = byYear.get(row.year - 1);
        if (!prior) {
          row.trendLabel = 'N/A';
          return;
        }

        row.turnoutDeltaYoY = row.turnoutOverall - prior.turnoutOverall;
        row.registrationShareOfCvapDeltaYoY = row.registrationShareOfCvap - prior.registrationShareOfCvap;
        row.ballotShareOfCvapDeltaYoY = row.ballotShareOfCvap - prior.ballotShareOfCvap;
        row.trendLabel = getTrendLabel(row.turnoutDeltaYoY);
      });
    });

    return stats;
  }, [cvapData, voterData, historyData]);

  const currentYearStats = useMemo(() => processedStats.filter(s => s.year === selectedYear), [processedStats, selectedYear]);
  const currentYearCvapPrecincts = useMemo(() => currentYearStats.filter(s => s.cvapTotal > 0), [currentYearStats]);

  const opportunityTargets = useMemo(() => {
    if (currentYearStats.length === 0) return [] as Array<{
      rank: number;
      precinct: string;
      score: number;
      turnoutGap: number;
      registrationMass: number;
      cvapGap: number;
      recentDecline: number;
      actionCategory: 'Registration Growth' | 'Persuasion' | 'GOTV Chase' | 'Election Day Logistics';
    }>;

    const statsByPrecinct = new Map(currentYearStats.map((row) => [row.precinct, row]));
    const topQuartileScores = getTopQuartileOpportunityScores(computeOpportunityScores(currentYearStats));

    return topQuartileScores.map((row, index) => {
      const stat = statsByPrecinct.get(row.precinct);
      return {
        rank: index + 1,
        precinct: row.precinct,
        score: row.score,
        turnoutGap: row.turnoutGapNorm,
        registrationMass: row.registrationMassNorm,
        cvapGap: row.cvapGapNorm,
        recentDecline: row.declineNorm,
        actionCategory: getRecommendedActionCategory(stat?.registrationShareOfCvap ?? 0, stat?.turnoutOverall ?? 0, stat?.turnoutDeltaYoY ?? null),
      };
    });
  }, [currentYearStats]);

  const filteredOpportunityTargets = useMemo(() => {
    if (opportunityActionFilter === 'ALL') return opportunityTargets;
    return opportunityTargets.filter((target) => target.actionCategory === opportunityActionFilter);
  }, [opportunityActionFilter, opportunityTargets]);

  const opportunityScoreByPrecinct = useMemo(() => {
    const scores = computeOpportunityScores(currentYearStats);
    return new Map(scores.map((score) => [score.precinct, score.score]));
  }, [currentYearStats]);

  const filteredStats = useMemo(() => {
    return processedStats.filter(s => {
      const yearMatch = s.year === selectedYear;
      const precinctMatch = selectedPrecinct === "ALL" || s.precinct === selectedPrecinct;
      return yearMatch && precinctMatch;
    });
  }, [processedStats, selectedYear, selectedPrecinct]);

  const cvapMatchSummary = useMemo(() => {
    if (cvapData.length === 0) return null;

    const statsKeySet = new Set(
      processedStats.map((s) => {
        const normalized = normalizePrecinct(s.precinct);
        return normalized ? `${s.year}:${normalized}` : null;
      }).filter((key): key is string => key !== null)
    );

    const statsPrecinctSet = new Set(
      processedStats
        .map((s) => normalizePrecinct(s.precinct))
        .filter((value): value is string => Boolean(value))
    );

    let matchedRows = 0;
    cvapData.forEach((record) => {
      const precinct = normalizePrecinct(record.precinct_abbrv);
      if (!precinct) return;

      const noLeadingZeros = precinct.replace(/^0+/, '');
      if (record.year === YEARLESS_CVAP) {
        if (statsPrecinctSet.has(precinct) || statsPrecinctSet.has(noLeadingZeros)) {
          matchedRows += 1;
        }
        return;
      }

      const exactKey = `${record.year}:${precinct}`;
      const altKey = `${record.year}:${noLeadingZeros}`;
      if (statsKeySet.has(exactKey) || statsKeySet.has(altKey)) {
        matchedRows += 1;
      }
    });

    return {
      totalRows: cvapData.length,
      matchedRows,
      unmatchedRows: Math.max(cvapData.length - matchedRows, 0),
    };
  }, [cvapData, processedStats]);

  const cvapUnmatchedRows = useMemo(() => {
    if (cvapData.length === 0) return [] as Array<{ year: number; precinct_abbrv: string; cvap_total: number; reason: string }>;

    const statsKeySet = new Set(
      processedStats.map((s) => {
        const normalized = normalizePrecinct(s.precinct);
        return normalized ? `${s.year}:${normalized}` : null;
      }).filter((key): key is string => key !== null)
    );

    const statsPrecinctSet = new Set(
      processedStats
        .map((s) => normalizePrecinct(s.precinct))
        .filter((value): value is string => Boolean(value))
    );

    return cvapData
      .map((record) => {
        const precinct = normalizePrecinct(record.precinct_abbrv);
        if (!precinct) {
          return { ...record, reason: 'Missing normalized precinct value' };
        }

        const noLeadingZeros = precinct.replace(/^0+/, '');
        if (record.year === YEARLESS_CVAP) {
          const hasPrecinctMatch = statsPrecinctSet.has(precinct) || statsPrecinctSet.has(noLeadingZeros);
          return hasPrecinctMatch ? null : { ...record, reason: 'No matching precinct in voter/history data' };
        }

        const exactKey = `${record.year}:${precinct}`;
        const altKey = `${record.year}:${noLeadingZeros}`;
        const hasYearMatch = statsKeySet.has(exactKey) || statsKeySet.has(altKey);
        return hasYearMatch ? null : { ...record, reason: 'No matching precinct-year in voter/history data' };
      })
      .filter((row): row is { year: number; precinct_abbrv: string; cvap_total: number; reason: string } => row !== null);
  }, [cvapData, processedStats]);

  const exportCvapIssueRows = () => {
    const rows = [
      ...cvapDroppedRows.map((row) => ({
        IssueType: 'Dropped During Parse',
        RowNumber: row.rowNumber,
        Reason: row.reason,
        Year: '',
        Precinct: String(getRowValue(row.row, CVAP_PRECINCT_KEYS) || ''),
        CVAP: String(getRowValue(row.row, CVAP_TOTAL_KEYS) || ''),
      })),
      ...cvapUnmatchedRows.map((row, index) => ({
        IssueType: 'Unmatched In Analysis',
        RowNumber: index + 1,
        Reason: row.reason,
        Year: row.year === YEARLESS_CVAP ? '' : row.year,
        Precinct: row.precinct_abbrv,
        CVAP: row.cvap_total,
      })),
    ];

    if (rows.length === 0) {
      setError('No CVAP issue rows are available to export.');
      return;
    }

    exportCsvFile(rows, 'cvap-issue-rows.csv');
  };

  const exportVoterIssueRows = () => {
    if (voterDroppedRows.length === 0) {
      setError('No voter issue rows are available to export.');
      return;
    }

    const rows = voterDroppedRows.map((row) => ({
      RowNumber: row.rowNumber,
      Reason: row.reason,
      Precinct: String(getRowValue(row.row, ['precinct_abbrv', 'precinct']) || ''),
      Party: String(getRowValue(row.row, ['party_cd', 'party']) || ''),
      Race: String(getRowValue(row.row, ['race_code', 'race']) || ''),
      Sex: String(getRowValue(row.row, ['sex_code', 'sex', 'gender']) || ''),
    }));

    exportCsvFile(rows, 'voter-issue-rows.csv');
  };

  const exportHistoryIssueRows = () => {
    if (historyDroppedRows.length === 0) {
      setError('No history issue rows are available to export.');
      return;
    }

    const rows = historyDroppedRows.map((row) => ({
      RowNumber: row.rowNumber,
      Reason: row.reason,
      Precinct: String(getRowValue(row.row, ['precinct_abbrv', 'precinct']) || ''),
      ElectionDate: String(getRowValue(row.row, ['election_date', 'date', 'electionday']) || ''),
      Party: String(getRowValue(row.row, ['party_cd', 'party']) || ''),
      Race: String(getRowValue(row.row, ['race_code', 'race']) || ''),
      Sex: String(getRowValue(row.row, ['sex_code', 'sex', 'gender']) || ''),
    }));

    exportCsvFile(rows, 'history-issue-rows.csv');
  };

  const loadBundledData = async ({ activateDashboard = true, silent = false }: { activateDashboard?: boolean; silent?: boolean } = {}) => {  // eslint-disable-line react-hooks/exhaustive-deps
    setIsProcessing(true);
    if (!silent) setError(null);

    try {
      const [voterJson, historyJson] = await Promise.all([
        fetchJsonAsset<Record<string, unknown>[]>('data/union_voter_stats.json'),
        fetchJsonAsset<Record<string, unknown>[]>('data/union_history_stats.json'),
      ]);

      if (!Array.isArray(voterJson) || !Array.isArray(historyJson)) {
        throw new Error('Built-in data files are not in the expected array format.');
      }

      const normalizedVoter = voterJson.map(normalizeVoterRecord).filter((r): r is VoterRecord => r !== null);
      const normalizedHistory = historyJson.map(normalizeHistoryRecord).filter((r): r is HistoryRecord => r !== null);

      setVoterData(normalizedVoter);
      setVoterDroppedRows([]);
      setVoterUploadSummary({
        parsedRows: voterJson.length,
        usableRows: normalizedVoter.length,
        droppedRows: voterJson.length - normalizedVoter.length,
      });

      setHistoryData(normalizedHistory);
      setHistoryDroppedRows([]);
      setHistoryUploadSummary({
        parsedRows: historyJson.length,
        usableRows: normalizedHistory.length,
        droppedRows: historyJson.length - normalizedHistory.length,
      });

      const headers = ['county_desc', 'year', 'precinct_abbrv', 'cvap_total'];
      setCvapHeaderValidation({
        headers,
        matchedHeaders: {
          precinct: getMatchedHeaders(headers, CVAP_PRECINCT_KEYS),
          total: getMatchedHeaders(headers, CVAP_TOTAL_KEYS),
          year: getMatchedHeaders(headers, CVAP_YEAR_KEYS),
          county: getMatchedHeaders(headers, COUNTY_KEYS),
        },
      });

      setCvapData([]);
      setCvapDroppedRows([]);
      setCvapUploadSummary({
        parsedRows: 0,
        usableRows: 0,
        droppedRows: 0,
      });
      if (activateDashboard) {
        setActiveTab('dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bundled data.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    void loadBundledData({ activateDashboard: true, silent: true });
  }, []);

  const avgRegistrationShareOfCvap = useMemo(() => {
    const totalCvap = filteredStats.reduce((acc, s) => acc + s.cvapTotal, 0);
    const totalRegistered = filteredStats.reduce((acc, s) => acc + s.totalReg, 0);
    return totalCvap > 0 ? (totalRegistered / totalCvap) * 100 : 0;
  }, [filteredStats]);

  const improvingPrecincts = useMemo(() => {
    return [...currentYearStats]
      .filter((s) => s.turnoutDeltaYoY !== null)
      .sort((a, b) => (b.turnoutDeltaYoY || 0) - (a.turnoutDeltaYoY || 0))
      .slice(0, 5);
  }, [currentYearStats]);

  const decliningPrecincts = useMemo(() => {
    return [...currentYearStats]
      .filter((s) => s.turnoutDeltaYoY !== null)
      .sort((a, b) => (a.turnoutDeltaYoY || 0) - (b.turnoutDeltaYoY || 0))
      .slice(0, 5);
  }, [currentYearStats]);

  const cvapGainPrecincts = useMemo(() => {
    return [...currentYearStats]
      .filter((s) => s.ballotShareOfCvapDeltaYoY !== null)
      .sort((a, b) => (b.ballotShareOfCvapDeltaYoY || 0) - (a.ballotShareOfCvapDeltaYoY || 0))
      .slice(0, 5);
  }, [currentYearStats]);

  const countyTurnoutDeltaYoY = useMemo(() => {
    const previousYearStats = processedStats.filter((s) => s.year === selectedYear - 1);
    if (currentYearStats.length === 0 || previousYearStats.length === 0) return null;

    const currentTurnout = (currentYearStats.reduce((acc, s) => acc + s.totalBallots, 0) / (currentYearStats.reduce((acc, s) => acc + s.totalReg, 0) || 1)) * 100;
    const previousTurnout = (previousYearStats.reduce((acc, s) => acc + s.totalBallots, 0) / (previousYearStats.reduce((acc, s) => acc + s.totalReg, 0) || 1)) * 100;
    return currentTurnout - previousTurnout;
  }, [currentYearStats, processedStats, selectedYear]);

  const countyBallotsCvapDeltaYoY = useMemo(() => {
    const previousYearStats = processedStats.filter((s) => s.year === selectedYear - 1);
    if (currentYearStats.length === 0 || previousYearStats.length === 0) return null;

    const currentBallots = currentYearStats.reduce((acc, s) => acc + s.totalBallots, 0);
    const currentCvap = currentYearStats.reduce((acc, s) => acc + s.cvapTotal, 0);
    const previousBallots = previousYearStats.reduce((acc, s) => acc + s.totalBallots, 0);
    const previousCvap = previousYearStats.reduce((acc, s) => acc + s.cvapTotal, 0);

    const currentBallotShare = currentCvap > 0 ? (currentBallots / currentCvap) * 100 : 0;
    const previousBallotShare = previousCvap > 0 ? (previousBallots / previousCvap) * 100 : 0;
    return currentBallotShare - previousBallotShare;
  }, [currentYearStats, processedStats, selectedYear]);

  const voterSuccessRate = useMemo(() => {
    if (!voterUploadSummary || voterUploadSummary.parsedRows === 0) return null;
    return (voterUploadSummary.usableRows / voterUploadSummary.parsedRows) * 100;
  }, [voterUploadSummary]);

  const historySuccessRate = useMemo(() => {
    if (!historyUploadSummary || historyUploadSummary.parsedRows === 0) return null;
    return (historyUploadSummary.usableRows / historyUploadSummary.parsedRows) * 100;
  }, [historyUploadSummary]);

  const cvapSuccessRate = useMemo(() => {
    if (!cvapUploadSummary || cvapUploadSummary.parsedRows === 0) return null;
    return (cvapUploadSummary.usableRows / cvapUploadSummary.parsedRows) * 100;
  }, [cvapUploadSummary]);

  const precinctYearCoverage = useMemo(() => {
    const uniquePrecincts = new Set([
      ...voterData.map((row) => row.precinct_abbrv),
      ...historyData.map((row) => row.precinct_abbrv),
    ].filter(Boolean));

    if (uniquePrecincts.size === 0) return null;
    const expectedRows = uniquePrecincts.size * YEARS.length;
    return expectedRows > 0 ? (processedStats.length / expectedRows) * 100 : null;
  }, [historyData, processedStats, voterData]);

  const cvapMatchRate = useMemo(() => {
    if (!cvapMatchSummary || cvapMatchSummary.totalRows === 0) return null;
    return (cvapMatchSummary.matchedRows / cvapMatchSummary.totalRows) * 100;
  }, [cvapMatchSummary]);

  const scenarioProjection = useMemo(() => {
    const rows = filteredStats.map((s) => {
      const projectedBallots = Math.min(s.totalReg, s.totalBallots * (1 + scenarioTurnoutLiftPct / 100));
      const additionalBallots = Math.max(projectedBallots - s.totalBallots, 0);
      return {
        precinct: s.precinct,
        baselineBallots: s.totalBallots,
        projectedBallots,
        additionalBallots,
      };
    });

    const baselineBallots = rows.reduce((acc, row) => acc + row.baselineBallots, 0);
    const projectedBallots = rows.reduce((acc, row) => acc + row.projectedBallots, 0);
    const additionalBallots = rows.reduce((acc, row) => acc + row.additionalBallots, 0);
    const topGains = [...rows].sort((a, b) => b.additionalBallots - a.additionalBallots).slice(0, 5);

    return {
      rows,
      baselineBallots,
      projectedBallots,
      additionalBallots,
      topGains,
    };
  }, [filteredStats, scenarioTurnoutLiftPct]);

  const exportScenarioCsv = () => {
    if (scenarioProjection.rows.length === 0) {
      setError('No scenario rows are available to export for the selected filters.');
      setScenarioNotice({ type: 'error', message: 'No scenario rows available for export under current filters.' });
      return;
    }

    const rows = scenarioProjection.rows.map((row) => {
      const matchingStat = filteredStats.find((s) => s.precinct === row.precinct);
      const baselineTurnout = matchingStat?.turnoutOverall ?? 0;
      const projectedTurnout = matchingStat && matchingStat.totalReg > 0
        ? (row.projectedBallots / matchingStat.totalReg) * 100
        : 0;

      return {
        Year: selectedYear,
        Precinct: row.precinct,
        'Turnout Lift Assumption %': scenarioTurnoutLiftPct.toFixed(1),
        'Baseline Ballots': Math.round(row.baselineBallots),
        'Projected Ballots': Math.round(row.projectedBallots),
        'Estimated Additional Ballots': Math.round(row.additionalBallots),
        'Baseline Turnout %': baselineTurnout.toFixed(2),
        'Projected Turnout %': projectedTurnout.toFixed(2),
      };
    });

    exportCsvFile(rows, `scenario_projection_${selectedYear}.csv`);
    setScenarioNotice({ type: 'success', message: `Exported scenario projection CSV for ${selectedYear}.` });
  };

  const exportSummaryCsv = () => {
    const rows = filteredStats.map(s => ({
      Year: s.year,
      Precinct: s.precinct,
      Trend: s.trendLabel,
      CVAP: s.cvapTotal || '',
      'Total Registered': s.totalReg,
      'Registered / CVAP %': s.cvapTotal > 0 ? s.registrationShareOfCvap.toFixed(2) : '',
      'Registered / CVAP Δ YoY (pts)': s.registrationShareOfCvapDeltaYoY !== null ? s.registrationShareOfCvapDeltaYoY.toFixed(2) : '',
      'Total Ballots': s.totalBallots,
      'Turnout %': s.turnoutOverall.toFixed(2),
      'Turnout Δ YoY (pts)': s.turnoutDeltaYoY !== null ? s.turnoutDeltaYoY.toFixed(2) : '',
      'Ballots / CVAP %': s.cvapTotal > 0 ? s.ballotShareOfCvap.toFixed(2) : '',
      'Ballots / CVAP Δ YoY (pts)': s.ballotShareOfCvapDeltaYoY !== null ? s.ballotShareOfCvapDeltaYoY.toFixed(2) : '',
      ...Object.fromEntries(RACE_CODES.map(r => [`Reg ${r}`, s.regByRace[r] || 0])),
      ...Object.fromEntries(PARTY_CODES.map(p => [`Reg ${p}`, s.regByParty[p] || 0])),
      ...Object.fromEntries(GENDER_CODES.map(g => [`Reg ${g}`, s.regByGender[g] || 0])),
      ...Object.fromEntries(RACE_CODES.map(r => [`Turnout ${r} %`, (s.turnoutByRace[r] || 0).toFixed(2)])),
      ...Object.fromEntries(RACE_CODES.map(r => [`Density ${r} %`, (s.densityByRace[r] || 0).toFixed(2)])),
    }));

    exportCsvFile(rows, `Union_County_Analysis_${selectedYear}.csv`);
  };

  const copyScenarioAssumptions = async () => {
    const generatedAt = new Date().toISOString();
    const assumptionsText = [
      `Year: ${selectedYear}`,
      `Precinct Filter: ${selectedPrecinct}`,
      `Turnout Lift Assumption (%): ${scenarioTurnoutLiftPct.toFixed(1)}`,
      `Filtered Rows: ${filteredStats.length}`,
      `Generated At (UTC): ${generatedAt}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(assumptionsText);
      setScenarioNotice({ type: 'success', message: 'Copied scenario assumptions to clipboard.' });
    } catch {
      setError('Could not copy scenario assumptions to clipboard in this browser context.');
      setScenarioNotice({ type: 'error', message: 'Copy assumptions failed in this browser context.' });
    }
  };

  const exportPlanningBundleCsv = () => {
    if (filteredStats.length === 0 && scenarioProjection.rows.length === 0) {
      setError('No planning rows are available to export for the selected filters.');
      setScenarioNotice({ type: 'error', message: 'No planning rows available for bundle export.' });
      return;
    }

    const generatedAt = new Date().toISOString();
    const assumptionRows = [
      {
        RowType: 'Assumption',
        Year: selectedYear,
        Precinct: 'Filter',
        Trend: selectedPrecinct,
        CVAP: '',
        'Total Registered': '',
        'Registered / CVAP %': '',
        'Registered / CVAP Δ YoY (pts)': '',
        'Total Ballots': '',
        'Turnout %': '',
        'Turnout Δ YoY (pts)': '',
        'Ballots / CVAP %': '',
        'Ballots / CVAP Δ YoY (pts)': '',
        'Turnout Lift Assumption %': scenarioTurnoutLiftPct.toFixed(1),
        'Projected Ballots': '',
        'Estimated Additional Ballots': '',
        'Projected Turnout %': '',
      },
      {
        RowType: 'Assumption',
        Year: selectedYear,
        Precinct: 'Filtered Rows',
        Trend: String(filteredStats.length),
        CVAP: '',
        'Total Registered': '',
        'Registered / CVAP %': '',
        'Registered / CVAP Δ YoY (pts)': '',
        'Total Ballots': '',
        'Turnout %': '',
        'Turnout Δ YoY (pts)': '',
        'Ballots / CVAP %': '',
        'Ballots / CVAP Δ YoY (pts)': '',
        'Turnout Lift Assumption %': '',
        'Projected Ballots': '',
        'Estimated Additional Ballots': '',
        'Projected Turnout %': '',
      },
      {
        RowType: 'Assumption',
        Year: selectedYear,
        Precinct: 'Generated At (UTC)',
        Trend: generatedAt,
        CVAP: '',
        'Total Registered': '',
        'Registered / CVAP %': '',
        'Registered / CVAP Δ YoY (pts)': '',
        'Total Ballots': '',
        'Turnout %': '',
        'Turnout Δ YoY (pts)': '',
        'Ballots / CVAP %': '',
        'Ballots / CVAP Δ YoY (pts)': '',
        'Turnout Lift Assumption %': '',
        'Projected Ballots': '',
        'Estimated Additional Ballots': '',
        'Projected Turnout %': '',
      },
    ];

    const summaryRows = filteredStats.map((s) => ({
      RowType: 'Dashboard Summary',
      Year: s.year,
      Precinct: s.precinct,
      Trend: s.trendLabel,
      CVAP: s.cvapTotal || '',
      'Total Registered': s.totalReg,
      'Registered / CVAP %': s.cvapTotal > 0 ? s.registrationShareOfCvap.toFixed(2) : '',
      'Registered / CVAP Δ YoY (pts)': s.registrationShareOfCvapDeltaYoY !== null ? s.registrationShareOfCvapDeltaYoY.toFixed(2) : '',
      'Total Ballots': s.totalBallots,
      'Turnout %': s.turnoutOverall.toFixed(2),
      'Turnout Δ YoY (pts)': s.turnoutDeltaYoY !== null ? s.turnoutDeltaYoY.toFixed(2) : '',
      'Ballots / CVAP %': s.cvapTotal > 0 ? s.ballotShareOfCvap.toFixed(2) : '',
      'Ballots / CVAP Δ YoY (pts)': s.ballotShareOfCvapDeltaYoY !== null ? s.ballotShareOfCvapDeltaYoY.toFixed(2) : '',
      'Turnout Lift Assumption %': '',
      'Projected Ballots': '',
      'Estimated Additional Ballots': '',
      'Projected Turnout %': '',
    }));

    const scenarioRows = scenarioProjection.rows.map((row) => {
      const matchingStat = filteredStats.find((s) => s.precinct === row.precinct);
      const projectedTurnout = matchingStat && matchingStat.totalReg > 0
        ? (row.projectedBallots / matchingStat.totalReg) * 100
        : 0;

      return {
        RowType: 'Scenario Projection',
        Year: selectedYear,
        Precinct: row.precinct,
        Trend: '',
        CVAP: '',
        'Total Registered': matchingStat?.totalReg ?? '',
        'Registered / CVAP %': '',
        'Registered / CVAP Δ YoY (pts)': '',
        'Total Ballots': Math.round(row.baselineBallots),
        'Turnout %': matchingStat?.turnoutOverall.toFixed(2) ?? '',
        'Turnout Δ YoY (pts)': '',
        'Ballots / CVAP %': '',
        'Ballots / CVAP Δ YoY (pts)': '',
        'Turnout Lift Assumption %': scenarioTurnoutLiftPct.toFixed(1),
        'Projected Ballots': Math.round(row.projectedBallots),
        'Estimated Additional Ballots': Math.round(row.additionalBallots),
        'Projected Turnout %': projectedTurnout.toFixed(2),
      };
    });

    exportCsvFile([...assumptionRows, ...summaryRows, ...scenarioRows], `planning_bundle_${selectedYear}.csv`);
    setScenarioNotice({ type: 'success', message: `Exported planning bundle CSV for ${selectedYear}.` });
  };

  const exportOpportunityTargetsCsv = () => {
    if (filteredOpportunityTargets.length === 0) {
      setScenarioNotice({ type: 'error', message: 'No opportunity targets available for export.' });
      return;
    }

    const rows = filteredOpportunityTargets.map((target) => ({
      Year: selectedYear,
      Rank: target.rank,
      Precinct: target.precinct,
      'Recommended Action': target.actionCategory,
      'Opportunity Score (0-100)': (target.score * 100).toFixed(1),
      'Turnout Gap Driver (0-100)': (target.turnoutGap * 100).toFixed(0),
      'Registration Mass Driver (0-100)': (target.registrationMass * 100).toFixed(0),
      'CVAP Gap Driver (0-100)': (target.cvapGap * 100).toFixed(0),
      'Recent Decline Driver (0-100)': (target.recentDecline * 100).toFixed(0),
      'Precinct Filter': selectedPrecinct,
      'Action Filter': opportunityActionFilter,
    }));

    exportCsvFile(rows, `opportunity_targets_${selectedYear}.csv`);
    setScenarioNotice({ type: 'success', message: `Exported ${filteredOpportunityTargets.length} opportunity target rows for ${selectedYear}.` });
  };

  const exportFocusedFieldPacketCsv = () => {
    if (selectedPrecinct === 'ALL' || !filteredStats[0]) {
      setScenarioNotice({ type: 'error', message: 'Select a precinct to export a focused field packet.' });
      return;
    }

    const stat = filteredStats[0];
    const projectedBallots = Math.min(stat.totalReg, stat.totalBallots * (1 + scenarioTurnoutLiftPct / 100));
    const projectedTurnoutPct = stat.totalReg > 0 ? (projectedBallots / stat.totalReg) * 100 : 0;
    const additionalBallots = Math.max(projectedBallots - stat.totalBallots, 0);
    const actionCategory = getRecommendedActionCategory(stat.registrationShareOfCvap, stat.turnoutOverall, stat.turnoutDeltaYoY);
    const opportunityScore = opportunityScoreByPrecinct.get(stat.precinct) ?? null;
    const generatedAt = new Date().toISOString();

    const rows = [
      {
        RowType: 'Packet Metadata',
        Metric: 'Generated At (UTC)',
        Value: generatedAt,
      },
      {
        RowType: 'Packet Metadata',
        Metric: 'Selected Year',
        Value: selectedYear,
      },
      {
        RowType: 'Packet Metadata',
        Metric: 'Precinct',
        Value: stat.precinct,
      },
      {
        RowType: 'Packet Metadata',
        Metric: 'Turnout Lift Assumption %',
        Value: scenarioTurnoutLiftPct.toFixed(1),
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Opportunity Score (0-100)',
        Value: opportunityScore !== null ? (opportunityScore * 100).toFixed(1) : 'N/A',
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Recommended Action',
        Value: actionCategory,
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Total Registered',
        Value: stat.totalReg,
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Total Ballots',
        Value: stat.totalBallots,
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Turnout %',
        Value: stat.turnoutOverall.toFixed(2),
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Turnout Δ YoY (pts)',
        Value: stat.turnoutDeltaYoY !== null ? stat.turnoutDeltaYoY.toFixed(2) : 'N/A',
      },
      {
        RowType: 'Precinct Summary',
        Metric: 'Registered / CVAP %',
        Value: stat.cvapTotal > 0 ? stat.registrationShareOfCvap.toFixed(2) : 'N/A',
      },
      {
        RowType: 'Scenario Projection',
        Metric: 'Projected Ballots',
        Value: Math.round(projectedBallots),
      },
      {
        RowType: 'Scenario Projection',
        Metric: 'Projected Turnout %',
        Value: projectedTurnoutPct.toFixed(2),
      },
      {
        RowType: 'Scenario Projection',
        Metric: 'Estimated Additional Ballots',
        Value: Math.round(additionalBallots),
      },
    ];

    exportCsvFile(rows, `field_packet_${stat.precinct}_${selectedYear}.csv`);
    setScenarioNotice({ type: 'success', message: `Exported focused field packet for precinct ${stat.precinct}.` });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Union County Voter Intelligence</h1>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Field Organizer Dashboard</p>
                <p className="text-[11px] text-gray-500">Developed by JBPTV Consultancy Group. Blueprint for expansion across all 100 NC counties.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <TabButton 
                  active={activeTab === 'upload'} 
                  onClick={() => setActiveTab('upload')} 
                  icon={FileUp} 
                  label="Data Upload" 
                />
                <TabButton 
                  active={activeTab === 'dashboard'} 
                  onClick={() => setActiveTab('dashboard')} 
                  icon={BarChart3} 
                  label="Dashboard" 
                />
                <TabButton 
                  active={activeTab === 'readme'} 
                  onClick={() => setActiveTab('readme')} 
                  icon={Info} 
                  label="How-To" 
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex justify-end">
                <button
                  onClick={() => { void loadBundledData({ activateDashboard: true }); }}
                  disabled={isProcessing}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                    isProcessing ? "bg-gray-400 text-white cursor-not-allowed" : "bg-gray-800 text-white hover:bg-gray-900"
                  )}
                >
                  {isProcessing ? 'Loading Data...' : 'Reload Built-In Dataset'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors group">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-blue-50 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Database size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Voter Registration</h3>
                      <p className="text-sm text-gray-500 mt-1">Built-in data is preloaded. Upload voter_stats.txt only if you want to replace it.</p>
                    </div>
                    <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                      Select File
                      <input type="file" disabled={isProcessing} className="hidden" accept=".txt,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload('voter', e.target.files[0])} />
                    </label>
                    {voterData.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle2 size={16} />
                        {voterData.length.toLocaleString()} records loaded
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-400 transition-colors group">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-purple-50 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Calendar size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Voter History</h3>
                      <p className="text-sm text-gray-500 mt-1">Built-in data is preloaded. Upload history_stats.txt only if you want to replace it.</p>
                    </div>
                    <label className="cursor-pointer bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                      Select File
                      <input type="file" disabled={isProcessing} className="hidden" accept=".txt,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload('history', e.target.files[0])} />
                    </label>
                    {historyData.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle2 size={16} />
                        {historyData.length.toLocaleString()} records loaded
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-400 transition-colors group">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-orange-50 rounded-full text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <MapPin size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Census CVAP</h3>
                      <p className="text-sm text-gray-500 mt-1">Built-in data is preloaded. Upload CVAP only if you want to replace it.</p>
                    </div>
                    <label className="cursor-pointer bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors">
                      Select File
                      <input type="file" disabled={isProcessing} className="hidden" accept=".txt,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload('cvap', e.target.files[0])} />
                    </label>
                    {cvapData.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle2 size={16} />
                        {cvapData.length.toLocaleString()} records loaded
                      </div>
                    )}
                    <a
                      href={getPublicAssetPath('data/cvap-template.csv')}
                      download
                      className="text-xs font-medium text-orange-700 underline decoration-dotted hover:text-orange-800"
                    >
                      Download CVAP template
                    </a>
                  </div>
                </div>
              </div>

              {cvapUploadSummary && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-orange-900">
                  <p className="text-sm font-bold">CVAP Upload Summary</p>
                  <p className="text-sm mt-1">Parsed: {cvapUploadSummary.parsedRows.toLocaleString()} rows, usable: {cvapUploadSummary.usableRows.toLocaleString()}, dropped: {cvapUploadSummary.droppedRows.toLocaleString()}.</p>
                  {cvapMatchSummary && (
                    <p className="text-sm mt-1">Matched to precinct-year analysis rows: {cvapMatchSummary.matchedRows.toLocaleString()} / {cvapMatchSummary.totalRows.toLocaleString()}.</p>
                  )}
                  {cvapHeaderValidation && (
                    <div className="mt-3 text-sm space-y-1">
                      <p className="font-semibold">Header Validation</p>
                      <p>Precinct headers: {cvapHeaderValidation.matchedHeaders.precinct.length > 0 ? cvapHeaderValidation.matchedHeaders.precinct.join(', ') : 'Missing'}</p>
                      <p>CVAP total headers: {cvapHeaderValidation.matchedHeaders.total.length > 0 ? cvapHeaderValidation.matchedHeaders.total.join(', ') : 'Missing'}</p>
                      <p>Year headers (optional): {cvapHeaderValidation.matchedHeaders.year.length > 0 ? cvapHeaderValidation.matchedHeaders.year.join(', ') : 'Not provided'}</p>
                      <p>County headers (optional): {cvapHeaderValidation.matchedHeaders.county.length > 0 ? cvapHeaderValidation.matchedHeaders.county.join(', ') : 'Not provided'}</p>
                    </div>
                  )}
                  {(cvapDroppedRows.length > 0 || cvapUnmatchedRows.length > 0) && (
                    <button
                      onClick={exportCvapIssueRows}
                      className="mt-3 bg-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-orange-800 transition-colors"
                    >
                      Export CVAP Issue Rows CSV
                    </button>
                  )}
                </div>
              )}

              {voterUploadSummary && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-900">
                  <p className="text-sm font-bold">Voter Upload Summary</p>
                  <p className="text-sm mt-1">Parsed: {voterUploadSummary.parsedRows.toLocaleString()} rows, usable: {voterUploadSummary.usableRows.toLocaleString()}, dropped: {voterUploadSummary.droppedRows.toLocaleString()}.</p>
                  {voterDroppedRows.length > 0 && (
                    <button
                      onClick={exportVoterIssueRows}
                      className="mt-3 bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-800 transition-colors"
                    >
                      Export Voter Issue Rows CSV
                    </button>
                  )}
                </div>
              )}

              {historyUploadSummary && (
                <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl text-purple-900">
                  <p className="text-sm font-bold">History Upload Summary</p>
                  <p className="text-sm mt-1">Parsed: {historyUploadSummary.parsedRows.toLocaleString()} rows, usable: {historyUploadSummary.usableRows.toLocaleString()}, dropped: {historyUploadSummary.droppedRows.toLocaleString()}.</p>
                  {historyDroppedRows.length > 0 && (
                    <button
                      onClick={exportHistoryIssueRows}
                      className="mt-3 bg-purple-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-purple-800 transition-colors"
                    >
                      Export History Issue Rows CSV
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700">
                  <AlertCircle size={20} />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {voterData.length > 0 && historyData.length > 0 && (
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-xl text-white">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-blue-900">Data Ready for Analysis</h4>
                      <p className="text-blue-700">Both registration and history files are loaded. You can now view the dashboard.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
                  >
                    Go to Dashboard
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Filters */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <Filter size={18} className="text-gray-400" />
                  <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Filters:</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <label htmlFor="election-year" className="text-sm text-gray-500 font-medium">Election Year</label>
                  <select 
                    id="election-year"
                    aria-label="Election Year"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="precinct-filter" className="text-sm text-gray-500 font-medium">Precinct</label>
                  <select 
                    id="precinct-filter"
                    aria-label="Precinct"
                    value={selectedPrecinct}
                    onChange={(e) => setSelectedPrecinct(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="ALL">All Union County Precincts</option>
                    {Array.from(new Set(processedStats.map(s => s.precinct))).sort().map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="ml-auto">
                  <button 
                    onClick={exportSummaryCsv}
                    disabled={filteredStats.length === 0 || isProcessing}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm",
                      filteredStats.length === 0 || isProcessing
                        ? "bg-green-300 text-white cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    )}
                  >
                    <FileDown size={18} />
                    Export Summary CSV
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatCard 
                  title="Total Registered" 
                  value={filteredStats.reduce((acc, s) => acc + s.totalReg, 0).toLocaleString()} 
                  icon={Users} 
                  color="bg-blue-600" 
                />
                <StatCard 
                  title="Total Ballots Cast" 
                  value={filteredStats.reduce((acc, s) => acc + s.totalBallots, 0).toLocaleString()} 
                  icon={CheckCircle2} 
                  color="bg-purple-600" 
                />
                <StatCard 
                  title="Avg. Turnout" 
                  value={`${(filteredStats.reduce((acc, s) => acc + s.totalBallots, 0) / (filteredStats.reduce((acc, s) => acc + s.totalReg, 0) || 1) * 100).toFixed(2)}%`} 
                  icon={BarChart3} 
                  color="bg-emerald-600" 
                />
                <StatCard 
                  title="Precincts Analyzed" 
                  value={filteredStats.length} 
                  icon={MapPin} 
                  color="bg-orange-600" 
                />
                <StatCard 
                  title="Reg / CVAP" 
                  value={currentYearCvapPrecincts.length > 0 ? `${avgRegistrationShareOfCvap.toFixed(2)}%` : 'N/A'} 
                  subValue={currentYearCvapPrecincts.length > 0 ? `${currentYearCvapPrecincts.length} precincts matched to CVAP` : 'Upload CVAP data to enable'}
                  icon={Database} 
                  color="bg-slate-700" 
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Trend Signals ({selectedYear} vs {selectedYear - 1})</h3>
                  <div className="text-sm font-medium text-gray-600">
                    County Turnout Δ: <span className="font-bold text-gray-900">{formatDeltaPoints(countyTurnoutDeltaYoY)}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    Ballots/CVAP Δ: <span className="font-bold text-gray-900">{formatDeltaPoints(countyBallotsCvapDeltaYoY)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Top Improving Turnout</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {improvingPrecincts.length > 0 ? improvingPrecincts.map((stat) => (
                        <div key={`up-${stat.precinct}`} className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-900">{stat.precinct}</span>
                          <span className="font-bold text-emerald-800">{formatDeltaPoints(stat.turnoutDeltaYoY)}</span>
                        </div>
                      )) : <p className="text-emerald-800">No prior-year comparison available.</p>}
                    </div>
                  </div>

                  <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Largest Turnout Declines</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {decliningPrecincts.length > 0 ? decliningPrecincts.map((stat) => (
                        <div key={`down-${stat.precinct}`} className="flex items-center justify-between">
                          <span className="font-semibold text-rose-900">{stat.precinct}</span>
                          <span className="font-bold text-rose-800">{formatDeltaPoints(stat.turnoutDeltaYoY)}</span>
                        </div>
                      )) : <p className="text-rose-800">No prior-year comparison available.</p>}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Best Ballots/CVAP Gains</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {cvapGainPrecincts.length > 0 ? cvapGainPrecincts.map((stat) => (
                        <div key={`cvap-${stat.precinct}`} className="flex items-center justify-between">
                          <span className="font-semibold text-blue-900">{stat.precinct}</span>
                          <span className="font-bold text-blue-800">{formatDeltaPoints(stat.ballotShareOfCvapDeltaYoY)}</span>
                        </div>
                      )) : <p className="text-blue-800">No prior-year comparison available.</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Data Quality and Provenance</h3>
                  <p className="text-xs text-gray-500">Built-in source: {BUILT_IN_DATA_METADATA.source}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Voter Parse Success</p>
                    <p className="mt-1 text-xl font-bold text-blue-900">{formatPercent(voterSuccessRate)}</p>
                  </div>
                  <div className="rounded-lg border border-purple-100 bg-purple-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-700">History Parse Success</p>
                    <p className="mt-1 text-xl font-bold text-purple-900">{formatPercent(historySuccessRate)}</p>
                  </div>
                  <div className="rounded-lg border border-orange-100 bg-orange-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-700">CVAP Parse Success</p>
                    <p className="mt-1 text-xl font-bold text-orange-900">{formatPercent(cvapSuccessRate)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Precinct-Year Coverage</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{formatPercent(precinctYearCoverage)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider font-bold text-gray-500">CVAP Match Rate</p>
                    <p className="mt-1 font-semibold text-gray-900">{formatPercent(cvapMatchRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Matched rows over uploaded CVAP rows.</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Data Freshness</p>
                    <p className="mt-1 font-semibold text-gray-900">{new Date(BUILT_IN_DATA_METADATA.generatedAtUtc).toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Generated UTC: {BUILT_IN_DATA_METADATA.generatedAtUtc}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Election Coverage</p>
                    <p className="mt-1 font-semibold text-gray-900">{BUILT_IN_DATA_METADATA.electionsIncluded.join(', ')}</p>
                    <p className="text-xs text-gray-500 mt-1">Built-in CVAP included: {BUILT_IN_DATA_METADATA.cvapIncluded ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-lg font-bold text-gray-900">Scenario Planner</h3>
                  <div className="text-sm text-gray-600 font-medium">
                    Turnout Lift Assumption: <span className="font-bold text-gray-900">+{scenarioTurnoutLiftPct}%</span>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                  <label htmlFor="scenario-lift" className="block text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                    Modeled turnout lift across selected year and precinct filter
                  </label>
                  <input
                    id="scenario-lift"
                    type="range"
                    min={0}
                    max={20}
                    step={0.5}
                    value={scenarioTurnoutLiftPct}
                    onChange={(event) => setScenarioTurnoutLiftPct(Number(event.target.value))}
                    className="w-full"
                  />
                  <div className="mt-2 text-xs text-emerald-900">Range: 0% to 20% turnout lift.</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wider font-bold text-gray-500">Baseline Ballots</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{Math.round(scenarioProjection.baselineBallots).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <p className="text-xs uppercase tracking-wider font-bold text-blue-700">Projected Ballots</p>
                    <p className="mt-1 text-2xl font-bold text-blue-900">{Math.round(scenarioProjection.projectedBallots).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-xs uppercase tracking-wider font-bold text-emerald-700">Estimated Additional Ballots</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-900">+{Math.round(scenarioProjection.additionalBallots).toLocaleString()}</p>
                  </div>
                </div>

                {scenarioNotice && (
                  <div
                    role="status"
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm font-medium",
                      scenarioNotice.type === 'success'
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-red-200 bg-red-50 text-red-800"
                    )}
                  >
                    {scenarioNotice.message}
                  </div>
                )}

                <div className="flex justify-end">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { void copyScenarioAssumptions(); }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Copy Assumptions
                    </button>
                    <button
                      onClick={exportPlanningBundleCsv}
                      disabled={(filteredStats.length === 0 && scenarioProjection.rows.length === 0) || isProcessing}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                        (filteredStats.length === 0 && scenarioProjection.rows.length === 0) || isProcessing
                          ? "bg-slate-200 text-white cursor-not-allowed"
                          : "bg-slate-700 text-white hover:bg-slate-800"
                      )}
                    >
                      Export Planning Bundle CSV
                    </button>
                    <button
                      onClick={exportScenarioCsv}
                      disabled={scenarioProjection.rows.length === 0 || isProcessing}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                        scenarioProjection.rows.length === 0 || isProcessing
                          ? "bg-emerald-200 text-white cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      )}
                    >
                      Export Scenario CSV
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-600 mb-3">Top Estimated Precinct Gains</p>
                  <div className="space-y-2 text-sm">
                    {scenarioProjection.topGains.length > 0 ? scenarioProjection.topGains.map((row) => (
                      <div key={`scenario-${row.precinct}`} className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{row.precinct}</span>
                        <span className="font-bold text-emerald-700">+{Math.round(row.additionalBallots).toLocaleString()}</span>
                      </div>
                    )) : (
                      <p className="text-gray-500">No rows available for the selected filter.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h3 className="text-lg font-bold text-gray-900">Opportunity Targets (Top Quartile)</h3>
                  <div className="flex items-center gap-3">
                    <label htmlFor="opportunity-action-filter" className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Action Filter</label>
                    <select
                      id="opportunity-action-filter"
                      aria-label="Opportunity Action Filter"
                      value={opportunityActionFilter}
                      onChange={(event) => setOpportunityActionFilter(event.target.value as 'ALL' | 'Registration Growth' | 'Persuasion' | 'GOTV Chase' | 'Election Day Logistics')}
                      className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="ALL">All actions</option>
                      <option value="Registration Growth">Registration Growth</option>
                      <option value="Persuasion">Persuasion</option>
                      <option value="GOTV Chase">GOTV Chase</option>
                      <option value="Election Day Logistics">Election Day Logistics</option>
                    </select>
                    <p className="text-xs text-gray-500">Weighted model: turnout gap 45%, registration mass 25%, CVAP gap 20%, recent decline 10%.</p>
                    <button
                      onClick={exportOpportunityTargetsCsv}
                      disabled={filteredOpportunityTargets.length === 0 || isProcessing}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                        filteredOpportunityTargets.length === 0 || isProcessing
                          ? "bg-amber-100 text-amber-300 cursor-not-allowed"
                          : "bg-amber-500 text-white hover:bg-amber-600"
                      )}
                    >
                      Export Targets CSV
                    </button>
                  </div>
                </div>

                {filteredOpportunityTargets.length === 0 ? (
                  <p className="text-sm text-gray-500">No opportunity targets are available for the selected year and filter.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Precinct</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Recommended Action</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Turnout Gap</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. Mass</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">CVAP Gap</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Decline</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredOpportunityTargets.map((target) => (
                          <tr key={`target-${target.precinct}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-bold text-gray-800">{target.rank}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{target.precinct}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">{(target.score * 100).toFixed(1)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{target.actionCategory}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{(target.turnoutGap * 100).toFixed(0)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{(target.registrationMass * 100).toFixed(0)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{(target.cvapGap * 100).toFixed(0)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{(target.recentDecline * 100).toFixed(0)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedPrecinct(target.precinct)}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                Focus Precinct
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Map Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MapIcon size={20} className="text-blue-600" />
                      Turnout Choropleth Map
                    </h3>
                    <p className="text-xs text-gray-400 font-medium italic">Interactive: Hover for details, Click to filter</p>
                  </div>
                  <Suspense
                    fallback={
                      <div className="h-[500px] w-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-500 font-medium">Loading map module...</p>
                      </div>
                    }
                  >
                    <ChoroplethMap
                      stats={currentYearStats}
                      selectedPrecinct={selectedPrecinct}
                      onPrecinctSelect={setSelectedPrecinct}
                    />
                  </Suspense>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 size={20} className="text-purple-600" />
                    Precinct Insights
                  </h3>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[500px] overflow-y-auto space-y-6">
                    {selectedPrecinct === "ALL" ? (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                        <div className="p-4 bg-blue-50 rounded-full text-blue-600">
                          <MapPin size={32} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Select a Precinct</p>
                          <p className="text-sm text-gray-500">Click on the map or use the filter above to see specific precinct insights.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {filteredStats[0] && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Precinct {filteredStats[0].precinct}</p>
                                <h4 className="text-2xl font-bold text-gray-900">{filteredStats[0].turnoutOverall.toFixed(2)}% Turnout</h4>
                              </div>
                              <button 
                                onClick={() => {
                                  const s = filteredStats[0];
                                  const data = [
                                    { Metric: 'Year', Value: s.year },
                                    { Metric: 'Precinct', Value: s.precinct },
                                    { Metric: 'Trend', Value: s.trendLabel },
                                    { Metric: 'CVAP', Value: s.cvapTotal || '' },
                                    { Metric: 'Total Registered', Value: s.totalReg },
                                    { Metric: 'Registered / CVAP %', Value: s.cvapTotal > 0 ? s.registrationShareOfCvap.toFixed(2) : '' },
                                    { Metric: 'Registered / CVAP Δ YoY (pts)', Value: s.registrationShareOfCvapDeltaYoY !== null ? s.registrationShareOfCvapDeltaYoY.toFixed(2) : '' },
                                    { Metric: 'Total Ballots Cast', Value: s.totalBallots },
                                    { Metric: 'Overall Turnout %', Value: s.turnoutOverall.toFixed(2) },
                                    { Metric: 'Turnout Δ YoY (pts)', Value: s.turnoutDeltaYoY !== null ? s.turnoutDeltaYoY.toFixed(2) : '' },
                                    { Metric: 'Ballots / CVAP %', Value: s.cvapTotal > 0 ? s.ballotShareOfCvap.toFixed(2) : '' },
                                    { Metric: 'Ballots / CVAP Δ YoY (pts)', Value: s.ballotShareOfCvapDeltaYoY !== null ? s.ballotShareOfCvapDeltaYoY.toFixed(2) : '' },
                                    ...RACE_CODES.map(r => ({ Metric: `Reg Race ${r}`, Value: s.regByRace[r] || 0 })),
                                    ...PARTY_CODES.map(p => ({ Metric: `Reg Party ${p}`, Value: s.regByParty[p] || 0 })),
                                    ...GENDER_CODES.map(g => ({ Metric: `Reg Gender ${g}`, Value: s.regByGender[g] || 0 })),
                                    ...RACE_CODES.map(r => ({ Metric: `Turnout Race ${r} %`, Value: (s.turnoutByRace[r] || 0).toFixed(2) })),
                                    ...PARTY_CODES.map(p => ({ Metric: `Turnout Party ${p} %`, Value: (s.turnoutByParty[p] || 0).toFixed(2) })),
                                    ...RACE_CODES.map(r => ({ Metric: `Density Race ${r} %`, Value: (s.densityByRace[r] || 0).toFixed(2) })),
                                  ];
                                  exportCsvFile(data, `Precinct_${s.precinct}_${s.year}_Stats.csv`);
                                }}
                                disabled={isProcessing}
                                className={cn(
                                  "p-2 rounded-lg transition-all shadow-sm flex items-center gap-2 text-xs font-bold",
                                  isProcessing
                                    ? "bg-blue-100 text-blue-300 cursor-not-allowed"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                                )}
                                title="Export Precinct CSV"
                              >
                                <Download size={16} />
                                Export CSV
                              </button>
                              <button
                                onClick={exportFocusedFieldPacketCsv}
                                disabled={isProcessing}
                                className={cn(
                                  "p-2 rounded-lg transition-all shadow-sm flex items-center gap-2 text-xs font-bold",
                                  isProcessing
                                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white"
                                )}
                                title="Export Focused Field Packet"
                              >
                                <FileDown size={16} />
                                Export Field Packet
                              </button>
                            </div>

                            <div className="space-y-4">
                                <p className="text-sm text-gray-500 mt-1">Trend: <span className="font-semibold text-gray-700">{filteredStats[0].trendLabel}</span> ({formatDeltaPoints(filteredStats[0].turnoutDeltaYoY)})</p>
                              <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">CVAP Coverage</h5>
                              {filteredStats[0].cvapTotal > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">CVAP</p>
                                    <p className="mt-1 text-lg font-bold text-gray-900">{filteredStats[0].cvapTotal.toLocaleString()}</p>
                                  </div>
                                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Registered / CVAP</p>
                                    <p className="mt-1 text-lg font-bold text-gray-900">{filteredStats[0].registrationShareOfCvap.toFixed(1)}%</p>
                                  </div>
                                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 col-span-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ballots / CVAP</p>
                                    <p className="mt-1 text-lg font-bold text-gray-900">{filteredStats[0].ballotShareOfCvap.toFixed(1)}%</p>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No matching CVAP row was found for this precinct and year.</p>
                              )}
                            </div>

                            <div className="space-y-4">
                              <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">Registration Density</h5>
                              <div className="space-y-3">
                                {Object.entries(filteredStats[0].densityByRace)
                                  .sort(([, a], [, b]) => (b as number) - (a as number))
                                  .map(([race, density]) => (
                                    <div key={race} className="space-y-1">
                                      <div className="flex justify-between text-xs font-medium">
                                        <span className="text-gray-600">Race: {race}</span>
                                        <span className="text-gray-900 font-bold">{(density as number).toFixed(1)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${density}%` }}
                                          className="bg-blue-500 h-full"
                                        />
                                      </div>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h5 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-100 pb-2">Party Turnout</h5>
                              <div className="space-y-3">
                                {Object.entries(filteredStats[0].turnoutByParty)
                                  .sort(([, a], [, b]) => (b as number) - (a as number))
                                  .map(([party, turnout]) => (
                                    <div key={party} className="space-y-1">
                                      <div className="flex justify-between text-xs font-medium">
                                        <span className="text-gray-600">Party: {party}</span>
                                        <span className="text-gray-900 font-bold">{(turnout as number).toFixed(1)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${turnout}%` }}
                                          className="bg-purple-500 h-full"
                                        />
                                      </div>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Precinct</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">CVAP</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. Total</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. / CVAP</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ballots Cast</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Turnout %</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Turnout Δ YoY</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trend</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. REP</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. DEM</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. UNA</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. White</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. Black</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Turnout Black %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStats.map((s, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900 sticky left-0 bg-white group-hover:bg-gray-50">{s.precinct}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{s.cvapTotal > 0 ? s.cvapTotal.toLocaleString() : 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{s.totalReg.toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{s.cvapTotal > 0 ? `${s.registrationShareOfCvap.toFixed(1)}%` : 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{s.totalBallots.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-bold",
                              s.turnoutOverall > 60 ? "bg-green-100 text-green-700" : 
                              s.turnoutOverall > 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                            )}>
                              {s.turnoutOverall.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{formatDeltaPoints(s.turnoutDeltaYoY)}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-bold",
                              s.trendLabel === 'Improving' ? 'bg-emerald-100 text-emerald-700' :
                              s.trendLabel === 'Declining' ? 'bg-rose-100 text-rose-700' :
                              s.trendLabel === 'Flat' ? 'bg-slate-100 text-slate-700' : 'bg-gray-100 text-gray-500'
                            )}>
                              {s.trendLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByParty['REP'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByParty['DEM'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByParty['UNA'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByRace['W'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByRace['B'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.turnoutByRace['B'] || 0).toFixed(2)}%</td>
                        </tr>
                      ))}
                      {currentYearStats.length > 0 && (
                        <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-100">
                          <td className="px-6 py-4 text-blue-900 sticky left-0 bg-blue-50/50">ALL UNION COUNTY</td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + s.cvapTotal, 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + s.totalReg, 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + s.cvapTotal, 0) > 0
                              ? `${(currentYearStats.reduce((acc, s) => acc + s.totalReg, 0) / currentYearStats.reduce((acc, s) => acc + s.cvapTotal, 0) * 100).toFixed(2)}%`
                              : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + s.totalBallots, 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              {(currentYearStats.reduce((acc, s) => acc + s.totalBallots, 0) / (currentYearStats.reduce((acc, s) => acc + s.totalReg, 0) || 1) * 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">{formatDeltaPoints(countyTurnoutDeltaYoY)}</td>
                          <td className="px-6 py-4 text-sm text-blue-900">County Aggregate</td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + (s.regByParty['REP'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + (s.regByParty['DEM'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + (s.regByParty['UNA'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + (s.regByRace['W'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {currentYearStats.reduce((acc, s) => acc + (s.regByRace['B'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {(currentYearStats.reduce((acc, s) => acc + (s.ballotsByRace['B'] || 0), 0) / (currentYearStats.reduce((acc, s) => acc + (s.regByRace['B'] || 0), 0) || 1) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      )}
                      {filteredStats.length === 0 && (
                        <tr>
                          <td colSpan={14} className="px-6 py-12 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Search size={32} className="text-gray-300" />
                              <p className="font-medium">No data available for the selected filters.</p>
                              <p className="text-xs">Try uploading data files or changing the year/precinct.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'readme' && (
            <motion.div
              key="readme"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <Suspense
                fallback={
                  <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="animate-pulse space-y-4">
                      <div className="h-8 w-2/3 bg-gray-200 rounded"></div>
                      <div className="h-4 w-full bg-gray-100 rounded"></div>
                      <div className="h-4 w-5/6 bg-gray-100 rounded"></div>
                      <div className="h-32 w-full bg-gray-50 rounded-xl border border-gray-100"></div>
                    </div>
                  </div>
                }
              >
                <HowToPanel />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">© 2026 Union County Field Intelligence. For authorized organizer use only.</p>
        </div>
      </footer>
    </div>
  );
}
