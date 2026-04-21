import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'motion/react';
import { RotateCcw, XCircle } from 'lucide-react';
import { PrecinctStats } from '../types';
import {
  OpportunityScore,
  OpportunityWeights,
  DEFAULT_OPPORTUNITY_WEIGHTS,
  computeOpportunityScores,
  normalizeOpportunityWeights,
} from '../lib/opportunityScoring';
import { cn } from '../lib/utils';

interface ChoroplethMapProps {
  stats: PrecinctStats[];
  selectedPrecinct: string;
  onPrecinctSelect: (precinct: string) => void;
  /** Public-asset-relative URL for the precinct boundary GeoJSON (e.g. "data/union-county-precincts.geojson"). */
  geoJsonUrl: string;
}

export { computeOpportunityScores } from '../lib/opportunityScoring';

export const ChoroplethMap: React.FC<ChoroplethMapProps> = ({ stats, selectedPrecinct, onPrecinctSelect, geoJsonUrl }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{ name: string, stats?: PrecinctStats, opportunity?: OpportunityScore } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOpportunities, setShowOpportunities] = useState(false);
  const [opportunityWeights, setOpportunityWeights] = useState<OpportunityWeights>(DEFAULT_OPPORTUNITY_WEIGHTS);
  const mapFetchTimeoutMs = 15000;

  const normalizePrecinct = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/^0+/, '');
  const getFeaturePrecinct = (feature: any) => String(feature?.properties?.prec_id || feature?.properties?.PREC_NAME || feature?.properties?.PRECINCT || '');
  const selectedKey = normalizePrecinct(selectedPrecinct);

  const sortedPrecincts = useMemo(
    () => Array.from(new Set(stats.map((s) => s.precinct))).filter(Boolean).sort(),
    [stats]
  );

  const statsByPrecinct = useMemo(() => {
    const map = new Map<string, PrecinctStats>();
    stats.forEach((s) => {
      const key = normalizePrecinct(s.precinct);
      if (key && !map.has(key)) {
        map.set(key, s);
      }
    });
    return map;
  }, [stats]);

  const normalizedOpportunityWeights = useMemo(() => normalizeOpportunityWeights(opportunityWeights), [opportunityWeights]);

  const opportunityScoresByPrecinct = useMemo(() => {
    const scores = computeOpportunityScores(stats, opportunityWeights);
    return new Map(scores.map((score) => [normalizePrecinct(score.precinct), score]));
  }, [opportunityWeights, stats]);

  const opportunityPrecincts = useMemo(() => {
    const scores = computeOpportunityScores(stats, opportunityWeights);
    if (scores.length === 0) return new Set<string>();

    const quartileCount = Math.max(1, Math.ceil(scores.length * 0.25));
    const topQuartile = scores.slice(0, quartileCount).map((s) => normalizePrecinct(s.precinct));
    return new Set(topQuartile);
  }, [opportunityWeights, stats]);

  const opportunityColorScale = useMemo(() => {
    const topScores = Array.from(opportunityScoresByPrecinct.values())
      .filter((score) => opportunityPrecincts.has(normalizePrecinct(score.precinct)))
      .map((score) => score.score);

    const min = topScores.length > 0 ? Math.min(...topScores) : 0;
    const max = topScores.length > 0 ? Math.max(...topScores) : 1;
    return d3.scaleSequential(d3.interpolateOranges).domain([min, Math.max(max, min + 0.0001)]);
  }, [opportunityPrecincts, opportunityScoresByPrecinct]);

  const resetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(250)
      .call(zoomBehaviorRef.current.transform as any, d3.zoomIdentity);
  };

  const selectAdjacentPrecinct = (direction: 1 | -1) => {
    if (sortedPrecincts.length === 0) return;

    if (selectedPrecinct === 'ALL') {
      onPrecinctSelect(direction === 1 ? sortedPrecincts[0] : sortedPrecincts[sortedPrecincts.length - 1]);
      return;
    }

    const currentIndex = sortedPrecincts.findIndex((p) => p === selectedPrecinct);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (safeIndex + direction + sortedPrecincts.length) % sortedPrecincts.length;
    onPrecinctSelect(sortedPrecincts[nextIndex]);
  };

  useEffect(() => {
    const fetchGeoData = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), mapFetchTimeoutMs);

      try {
        setIsLoading(true);
        const response = await fetch(`${import.meta.env.BASE_URL}${geoJsonUrl.replace(/^\/+/, '')}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            Accept: 'application/geo+json, application/json',
          },
        });
        if (!response.ok) throw new Error('Failed to fetch GeoJSON');
        const data = await response.json();

        if (!data || !Array.isArray(data.features) || data.features.length === 0) {
          throw new Error('No precincts found in GeoJSON');
        }

        setGeoData(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading map data:', err);
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('Map request timed out while loading precinct boundaries.');
        } else {
          setError('Could not load the precinct map data.');
        }
        setIsLoading(false);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    fetchGeoData();
  }, []);

  useEffect(() => {
    if (!geoData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = 500;
    
    const projection = d3.geoMercator()
      .fitSize([width, height], geoData);
    
    const path = d3.geoPath().projection(projection);

    // Color scale for turnout
    const colorScale = d3.scaleSequential(d3.interpolateYlGnBu)
      .domain([0, 100]);

    const g = svg.append('g').attr('class', 'map-layer');

    const getPrecinctStats = (feature: any) => statsByPrecinct.get(normalizePrecinct(getFeaturePrecinct(feature)));
    const isFeatureSelected = (feature: any) => normalizePrecinct(getFeaturePrecinct(feature)) === selectedKey;

    // Draw precincts
    g.selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', path as any)
      .attr('class', 'precinct-path cursor-pointer transition-all duration-200')
      .attr('stroke', '#fff')
      .attr('stroke-width', (d: any) => {
        return isFeatureSelected(d) ? 3 : 0.5;
      })
      .attr('fill', (d: any) => {
        const precinctKey = normalizePrecinct(getFeaturePrecinct(d));
        const precinctStats = getPrecinctStats(d);
        if (!precinctStats) return '#f3f4f6';
        if (showOpportunities && opportunityPrecincts.has(precinctKey)) {
          const score = opportunityScoresByPrecinct.get(precinctKey);
          return opportunityColorScale(score?.score ?? 0);
        }
        return colorScale(precinctStats.turnoutOverall);
      })
      .attr('opacity', (d: any) => {
        if (!showOpportunities) return 1;
        const precinctKey = normalizePrecinct(getFeaturePrecinct(d));
        return opportunityPrecincts.has(precinctKey) ? 1 : 0.35;
      })
      .on('mouseover', (event, d: any) => {
        const precinctName = getFeaturePrecinct(d);
        const precinctStats = getPrecinctStats(d);
        const opportunity = opportunityScoresByPrecinct.get(normalizePrecinct(precinctStats?.precinct || precinctName));
        
        d3.select(event.currentTarget)
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2)
          .raise();
          
        setHoveredInfo({ name: precinctName, stats: precinctStats, opportunity });
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on('mousemove', (event) => {
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on('mouseout', (event, d: any) => {
        d3.select(event.currentTarget)
          .attr('stroke', isFeatureSelected(d) ? '#3b82f6' : '#fff')
          .attr('stroke-width', isFeatureSelected(d) ? 3 : 0.5);
        setHoveredInfo(null);
      })
      .on('click', (event, d: any) => {
        event.preventDefault();

        const precinctName = getFeaturePrecinct(d);
        const match = getPrecinctStats(d);
        onPrecinctSelect(match?.precinct || precinctName);

        if (!svgRef.current || !zoomBehaviorRef.current) return;

        const bounds = path.bounds(d);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = Math.max(1, Math.min(7, 0.8 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];

        const transform = d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale);
        svg
          .transition()
          .duration(300)
          .call(zoomBehaviorRef.current.transform as any, transform);
      });

    // Add zoom
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom as any);

  }, [geoData, opportunityColorScale, opportunityPrecincts, opportunityScoresByPrecinct, selectedKey, showOpportunities, statsByPrecinct]);

  if (isLoading) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading map boundaries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center bg-red-50 rounded-xl border border-red-200 p-8 text-center">
        <p className="text-red-600 font-bold mb-2">Map Error</p>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-300"
      tabIndex={0}
      role="group"
      aria-label="Interactive precinct map"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          selectAdjacentPrecinct(1);
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          selectAdjacentPrecinct(-1);
        }
        if (event.key.toLowerCase() === 'escape') {
          event.preventDefault();
          onPrecinctSelect('ALL');
          resetZoom();
        }
      }}
    >
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur p-3 rounded-lg border border-gray-200 shadow-sm">
        <h4 className="text-sm font-bold text-gray-900 mb-2">Turnout Legend</h4>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-[#ffffd9]"></div>
          <span className="text-xs text-gray-600">0%</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-[#41b6c4]"></div>
          <span className="text-xs text-gray-600">50%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#081d58]"></div>
          <span className="text-xs text-gray-600">100%</span>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
          <button
            onClick={() => setShowOpportunities((value) => !value)}
            className={cn(
              'w-full px-2 py-1.5 rounded-md text-xs font-semibold transition-colors',
              showOpportunities ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {showOpportunities ? 'Opportunity Mode: ON' : 'Opportunity Mode: OFF'}
          </button>
          <p className="text-[10px] text-gray-500 leading-snug">
            Opportunity score uses custom weights. Top quartile precincts are highlighted.
          </p>
          <div className="rounded-md border border-amber-100 bg-amber-50/70 p-2 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-amber-900">
              <span>Turnout Gap</span>
              <span>{(normalizedOpportunityWeights.turnoutGap * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opportunityWeights.turnoutGap}
              onChange={(event) => setOpportunityWeights((prev) => ({ ...prev, turnoutGap: Number(event.target.value) }))}
              aria-label="Opportunity weight turnout gap"
              className="w-full"
            />

            <div className="flex items-center justify-between text-[10px] font-semibold text-amber-900">
              <span>Registration Mass</span>
              <span>{(normalizedOpportunityWeights.registrationMass * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opportunityWeights.registrationMass}
              onChange={(event) => setOpportunityWeights((prev) => ({ ...prev, registrationMass: Number(event.target.value) }))}
              aria-label="Opportunity weight registration mass"
              className="w-full"
            />

            <div className="flex items-center justify-between text-[10px] font-semibold text-amber-900">
              <span>CVAP Gap</span>
              <span>{(normalizedOpportunityWeights.cvapGap * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opportunityWeights.cvapGap}
              onChange={(event) => setOpportunityWeights((prev) => ({ ...prev, cvapGap: Number(event.target.value) }))}
              aria-label="Opportunity weight CVAP gap"
              className="w-full"
            />

            <div className="flex items-center justify-between text-[10px] font-semibold text-amber-900">
              <span>Recent Decline</span>
              <span>{(normalizedOpportunityWeights.recentDecline * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opportunityWeights.recentDecline}
              onChange={(event) => setOpportunityWeights((prev) => ({ ...prev, recentDecline: Number(event.target.value) }))}
              aria-label="Opportunity weight recent decline"
              className="w-full"
            />

            <button
              onClick={() => setOpportunityWeights(DEFAULT_OPPORTUNITY_WEIGHTS)}
              className="w-full px-2 py-1.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200"
            >
              Reset score weights
            </button>
          </div>
          <button
            onClick={resetZoom}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors',
              'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            <RotateCcw size={14} />
            Reset map view
          </button>
          <button
            onClick={() => onPrecinctSelect('ALL')}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold transition-colors',
              selectedPrecinct === 'ALL' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            )}
            disabled={selectedPrecinct === 'ALL'}
          >
            <XCircle size={14} />
            Clear precinct selection
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => selectAdjacentPrecinct(-1)}
              className="px-2 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Prev precinct
            </button>
            <button
              onClick={() => selectAdjacentPrecinct(1)}
              className="px-2 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Next precinct
            </button>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-200 shadow-sm text-xs text-gray-600">
        {selectedPrecinct === 'ALL' ? 'Tip: click a precinct to focus insights.' : `Selected: ${selectedPrecinct}`}
      </div>

      <svg 
        ref={svgRef} 
        className="w-full h-[500px] cursor-grab active:cursor-grabbing"
      />

      {hoveredInfo && (
        <motion.div
          initial={false}
          animate={{ x: tooltipPos.x + 15, y: tooltipPos.y + 15 }}
          transition={{ type: 'tween', duration: 0.08 }}
          className="fixed top-0 left-0 z-50 bg-white p-4 rounded-xl shadow-2xl border border-gray-100 pointer-events-none min-w-[220px]"
        >
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Precinct {hoveredInfo.name}</p>
              {hoveredInfo.stats ? (
                <h5 className="text-lg font-bold text-gray-900">{hoveredInfo.stats.turnoutOverall.toFixed(2)}% Turnout</h5>
              ) : (
                <h5 className="text-lg font-bold text-gray-400 italic">No Data Available</h5>
              )}
            </div>
            
            {hoveredInfo.stats && (
              <>
                <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-2.5">
                  <p className="text-[10px] font-bold text-amber-800 uppercase">Opportunity Score</p>
                  <p className="text-sm font-bold text-amber-900">
                    {hoveredInfo.opportunity ? `${(hoveredInfo.opportunity.score * 100).toFixed(1)} / 100` : 'N/A'}
                  </p>
                  {hoveredInfo.opportunity && (
                    <p className="text-[10px] text-amber-900 mt-1">
                      Drivers: turnout gap {(hoveredInfo.opportunity.turnoutGapNorm * 100).toFixed(0)}, registration {(hoveredInfo.opportunity.registrationMassNorm * 100).toFixed(0)}, CVAP gap {(hoveredInfo.opportunity.cvapGapNorm * 100).toFixed(0)}.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Registered</p>
                    <p className="text-sm font-bold text-gray-700">{hoveredInfo.stats.totalReg.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Ballots Cast</p>
                    <p className="text-sm font-bold text-gray-700">{hoveredInfo.stats.totalBallots.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">CVAP</p>
                    <p className="text-sm font-bold text-gray-700">{hoveredInfo.stats.cvapTotal > 0 ? hoveredInfo.stats.cvapTotal.toLocaleString() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Reg / CVAP</p>
                    <p className="text-sm font-bold text-gray-700">{hoveredInfo.stats.cvapTotal > 0 ? `${hoveredInfo.stats.registrationShareOfCvap.toFixed(1)}%` : 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Top Party Turnout</p>
                  {Object.entries(hoveredInfo.stats.turnoutByParty)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 2)
                    .map(([party, turnout]) => (
                      <div key={party} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-gray-600">{party}</span>
                        <span className="font-bold text-gray-900">{(turnout as number).toFixed(1)}%</span>
                      </div>
                    ))
                  }
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
