import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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
  Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PrecinctStats } from './types';
import { ChoroplethMap } from './components/ChoroplethMap';

// --- Constants ---
const UNION_COUNTY = "UNION";
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const RACE_CODES = ['W', 'B', 'A', 'I', 'M', 'O', 'P', 'U'];
const PARTY_CODES = ['REP', 'DEM', 'UNA', 'LIB', 'GRE', 'CST', 'NLB'];
const GENDER_CODES = ['M', 'F', 'U'];

// --- Components ---

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
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

const StatCard = ({ title, value, subValue, icon: Icon, color }: { title: string, value: string | number, subValue?: string, icon: any, color: string }) => (
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'readme'>('upload');
  const [voterData, setVoterData] = useState<any[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [cvapData, setCvapData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedPrecinct, setSelectedPrecinct] = useState<string>("ALL");

  // --- Data Processing ---

  const handleFileUpload = (type: 'voter' | 'history' | 'cvap', file: File) => {
    setIsProcessing(true);
    setError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const data = results.data as any[];
        
        // Basic validation for Union County
        const filtered = data.filter(row => {
          if (!row.county_desc) return true; // Some files might not have it, handle gracefully
          return String(row.county_desc).toUpperCase() === UNION_COUNTY;
        });

        if (type === 'voter') setVoterData(filtered);
        else if (type === 'history') setHistoryData(filtered);
        else if (type === 'cvap') setCvapData(filtered);

        setIsProcessing(false);
      },
      error: (err) => {
        setError(`Error parsing ${type} file: ${err.message}`);
        setIsProcessing(false);
      }
    });
  };

  // Derived Stats
  const processedStats = useMemo(() => {
    if (voterData.length === 0 && historyData.length === 0) return [];

    const stats: PrecinctStats[] = [];
    const precincts = Array.from(new Set([
      ...voterData.map(d => d.precinct_abbrv),
      ...historyData.map(d => d.precinct_abbrv)
    ])).filter(Boolean).sort();

    YEARS.forEach(year => {
      precincts.forEach(precinct => {
        // Filter registration data for this precinct
        const precinctReg = voterData.filter(d => d.precinct_abbrv === precinct);
        
        // Filter history data for this precinct and year
        const precinctHistory = historyData.filter(d => {
          const electionYear = d.election_date ? new Date(d.election_date).getFullYear() : null;
          return d.precinct_abbrv === precinct && electionYear === year;
        });

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
            densityByRace
          });
        }
      });
    });

    return stats;
  }, [voterData, historyData]);

  const filteredStats = useMemo(() => {
    return processedStats.filter(s => {
      const yearMatch = s.year === selectedYear;
      const precinctMatch = selectedPrecinct === "ALL" || s.precinct === selectedPrecinct;
      return yearMatch && precinctMatch;
    });
  }, [processedStats, selectedYear, selectedPrecinct]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredStats.map(s => ({
      Year: s.year,
      Precinct: s.precinct,
      'Total Registered': s.totalReg,
      'Total Ballots': s.totalBallots,
      'Turnout %': s.turnoutOverall.toFixed(2),
      ...Object.fromEntries(RACE_CODES.map(r => [`Reg ${r}`, s.regByRace[r] || 0])),
      ...Object.fromEntries(PARTY_CODES.map(p => [`Reg ${p}`, s.regByParty[p] || 0])),
      ...Object.fromEntries(GENDER_CODES.map(g => [`Reg ${g}`, s.regByGender[g] || 0])),
      ...Object.fromEntries(RACE_CODES.map(r => [`Turnout ${r} %`, (s.turnoutByRace[r] || 0).toFixed(2)])),
      ...Object.fromEntries(RACE_CODES.map(r => [`Density ${r} %`, (s.densityByRace[r] || 0).toFixed(2)])),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Precinct Analysis");
    XLSX.writeFile(wb, `Union_County_Analysis_${selectedYear}.xlsx`);
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors group">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 bg-blue-50 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Database size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Voter Registration</h3>
                      <p className="text-sm text-gray-500 mt-1">Upload voter_stats.txt from NCSBE</p>
                    </div>
                    <label className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                      Select File
                      <input type="file" className="hidden" accept=".txt,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload('voter', e.target.files[0])} />
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
                      <p className="text-sm text-gray-500 mt-1">Upload history_stats.txt from NCSBE</p>
                    </div>
                    <label className="cursor-pointer bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors">
                      Select File
                      <input type="file" className="hidden" accept=".txt,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload('history', e.target.files[0])} />
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
                      <p className="text-sm text-gray-500 mt-1">Upload Citizen Voting Age Population data</p>
                    </div>
                    <label className="cursor-pointer bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors">
                      Select File
                      <input type="file" className="hidden" accept=".txt,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload('cvap', e.target.files[0])} />
                    </label>
                    {cvapData.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle2 size={16} />
                        {cvapData.length.toLocaleString()} records loaded
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                  <label className="text-sm text-gray-500 font-medium">Election Year</label>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 font-medium">Precinct</label>
                  <select 
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
                    onClick={exportToExcel}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <FileDown size={18} />
                    Export to Excel
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <ChoroplethMap 
                    stats={processedStats.filter(s => s.year === selectedYear)}
                    selectedPrecinct={selectedPrecinct}
                    onPrecinctSelect={setSelectedPrecinct}
                  />
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
                                    { Metric: 'Total Registered', Value: s.totalReg },
                                    { Metric: 'Total Ballots Cast', Value: s.totalBallots },
                                    { Metric: 'Overall Turnout %', Value: s.turnoutOverall.toFixed(2) },
                                    ...RACE_CODES.map(r => ({ Metric: `Reg Race ${r}`, Value: s.regByRace[r] || 0 })),
                                    ...PARTY_CODES.map(p => ({ Metric: `Reg Party ${p}`, Value: s.regByParty[p] || 0 })),
                                    ...GENDER_CODES.map(g => ({ Metric: `Reg Gender ${g}`, Value: s.regByGender[g] || 0 })),
                                    ...RACE_CODES.map(r => ({ Metric: `Turnout Race ${r} %`, Value: (s.turnoutByRace[r] || 0).toFixed(2) })),
                                    ...PARTY_CODES.map(p => ({ Metric: `Turnout Party ${p} %`, Value: (s.turnoutByParty[p] || 0).toFixed(2) })),
                                    ...RACE_CODES.map(r => ({ Metric: `Density Race ${r} %`, Value: (s.densityByRace[r] || 0).toFixed(2) })),
                                  ];
                                  const csv = Papa.unparse(data);
                                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                  const link = document.createElement('a');
                                  const url = URL.createObjectURL(blob);
                                  link.setAttribute('href', url);
                                  link.setAttribute('download', `Precinct_${s.precinct}_${s.year}_Stats.csv`);
                                  link.style.visibility = 'hidden';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                                title="Export Precinct CSV"
                              >
                                <Download size={16} />
                                Export CSV
                              </button>
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
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. Total</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ballots Cast</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Turnout %</th>
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
                          <td className="px-6 py-4 text-sm text-gray-600">{s.totalReg.toLocaleString()}</td>
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
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByParty['REP'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByParty['DEM'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByParty['UNA'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByRace['W'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.regByRace['B'] || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{(s.turnoutByRace['B'] || 0).toFixed(2)}%</td>
                        </tr>
                      ))}
                      {processedStats.filter(s => s.year === selectedYear).length > 0 && (
                        <tr className="bg-blue-50/50 font-bold border-t-2 border-blue-100">
                          <td className="px-6 py-4 text-blue-900 sticky left-0 bg-blue-50/50">ALL UNION COUNTY</td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + s.totalReg, 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + s.totalBallots, 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                              {(processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + s.totalBallots, 0) / (processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + s.totalReg, 0) || 1) * 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.regByParty['REP'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.regByParty['DEM'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.regByParty['UNA'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.regByRace['W'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.regByRace['B'] || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-900">
                            {(processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.ballotsByRace['B'] || 0), 0) / (processedStats.filter(s => s.year === selectedYear).reduce((acc, s) => acc + (s.regByRace['B'] || 0), 0) || 1) * 100).toFixed(2)}%
                          </td>
                        </tr>
                      )}
                      {filteredStats.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
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
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm prose prose-blue max-w-none">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Union County Voter Intelligence Dashboard</h2>
                
                <section className="space-y-4">
                  <h3 className="text-xl font-bold text-blue-600">What this application provides</h3>
                  <p className="text-gray-600 leading-relaxed">
                    This dashboard is a specialized tool for field organizers in Union County, North Carolina. It synthesizes raw demographic and turnout data to provide actionable intelligence at the precinct level. By comparing registration numbers with actual ballots cast, organizers can identify critical engagement gaps and track shifting political landscapes.
                  </p>
                </section>

                <section className="space-y-4 mt-8">
                  <h3 className="text-xl font-bold text-blue-600">How to upload data</h3>
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
                    <div className="flex gap-4">
                      <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                      <div>
                        <p className="font-bold">Download NCSBE Files</p>
                        <p className="text-sm text-gray-600">Visit the NC State Board of Elections website and download the <code>voter_stats.txt</code> and <code>history_stats.txt</code> files.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                      <div>
                        <p className="font-bold">Upload to Dashboard</p>
                        <p className="text-sm text-gray-600">Navigate to the "Data Upload" tab and select the respective files. The app will automatically filter for Union County (County Code: UNION).</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                      <div>
                        <p className="font-bold">Analyze & Export</p>
                        <p className="text-sm text-gray-600">Once loaded, switch to the Dashboard tab to filter by year and precinct. Use the Export button to take the data into the field.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 mt-8">
                  <h3 className="text-xl font-bold text-blue-600">Organizer Interpretation Guide</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-100 p-5 rounded-xl bg-blue-50/30">
                      <h4 className="font-bold text-blue-900 flex items-center gap-2">
                        <AlertCircle size={18} />
                        Identifying Turnout Gaps
                      </h4>
                      <p className="text-sm text-gray-700 mt-2">
                        Look for precincts where "Registration Density" for a specific demographic is high, but "Turnout %" is significantly lower than the county average. These are prime targets for GOTV (Get Out The Vote) operations.
                      </p>
                    </div>
                    <div className="border border-gray-100 p-5 rounded-xl bg-purple-50/30">
                      <h4 className="font-bold text-purple-900 flex items-center gap-2">
                        <Users size={18} />
                        Tracking Unaffiliated Surge
                      </h4>
                      <p className="text-sm text-gray-700 mt-2">
                        Monitor the "Reg. UNA" column across years. A surge in Unaffiliated voters indicates a need for messaging that pivots away from partisan rhetoric toward issue-based canvassing.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
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
