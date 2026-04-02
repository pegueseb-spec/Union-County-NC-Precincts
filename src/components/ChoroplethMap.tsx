import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PrecinctStats } from '../types';
import { cn } from '../lib/utils';

interface ChoroplethMapProps {
  stats: PrecinctStats[];
  selectedPrecinct: string;
  onPrecinctSelect: (precinct: string) => void;
}

export const ChoroplethMap: React.FC<ChoroplethMapProps> = ({ stats, selectedPrecinct, onPrecinctSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{ name: string, stats?: PrecinctStats } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch NC Precincts GeoJSON
    const fetchGeoData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('https://raw.githubusercontent.com/opendata-nc/nc-precincts/master/nc_precincts.geojson');
        if (!response.ok) throw new Error('Failed to fetch GeoJSON');
        const data = await response.json();
        
        // Filter for Union County (FIPS 179)
        const unionPrecincts = {
          ...data,
          features: data.features.filter((f: any) => 
            f.properties.COUNTY_NAM === 'UNION' || f.properties.COUNTY_FIP === '179'
          )
        };
        
        if (unionPrecincts.features.length === 0) {
          throw new Error('No precincts found for Union County in GeoJSON');
        }
        
        setGeoData(unionPrecincts);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading map data:', err);
        setError('Could not load map boundaries. Please ensure you have an internet connection.');
        setIsLoading(false);
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

    const g = svg.append('g');

    // Draw precincts
    g.selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', path as any)
      .attr('class', 'precinct-path cursor-pointer transition-all duration-200')
      .attr('stroke', '#fff')
      .attr('stroke-width', (d: any) => {
        const precinctName = d.properties.PREC_NAME || d.properties.PRECINCT;
        return precinctName === selectedPrecinct ? 3 : 0.5;
      })
      .attr('fill', (d: any) => {
        const precinctName = d.properties.PREC_NAME || d.properties.PRECINCT;
        // Try to match precinct name
        const precinctStats = stats.find(s => 
          s.precinct === precinctName || 
          s.precinct.replace(/^0+/, '') === precinctName.replace(/^0+/, '')
        );
        return precinctStats ? colorScale(precinctStats.turnoutOverall) : '#f3f4f6';
      })
      .on('mouseover', (event, d: any) => {
        const precinctName = d.properties.PREC_NAME || d.properties.PRECINCT;
        const precinctStats = stats.find(s => 
          s.precinct === precinctName || 
          s.precinct.replace(/^0+/, '') === precinctName.replace(/^0+/, '')
        );
        
        d3.select(event.currentTarget)
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 2)
          .raise();
          
        setHoveredInfo({ name: precinctName, stats: precinctStats });
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on('mousemove', (event) => {
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on('mouseout', (event, d: any) => {
        const precinctName = d.properties.PREC_NAME || d.properties.PRECINCT;
        d3.select(event.currentTarget)
          .attr('stroke', precinctName === selectedPrecinct ? '#3b82f6' : '#fff')
          .attr('stroke-width', precinctName === selectedPrecinct ? 3 : 0.5);
        setHoveredInfo(null);
      })
      .on('click', (event, d: any) => {
        const precinctName = d.properties.PREC_NAME || d.properties.PRECINCT;
        onPrecinctSelect(precinctName);
      });

    // Add zoom
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

  }, [geoData, stats, selectedPrecinct]);

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
    <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
      </div>

      <svg 
        ref={svgRef} 
        className="w-full h-[500px] cursor-grab active:cursor-grabbing"
      />

      {hoveredInfo && (
        <div 
          className="fixed z-50 bg-white p-4 rounded-xl shadow-2xl border border-gray-100 pointer-events-none min-w-[220px]"
          style={{ 
            left: tooltipPos.x + 15, 
            top: tooltipPos.y + 15 
          }}
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
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Registered</p>
                    <p className="text-sm font-bold text-gray-700">{hoveredInfo.stats.totalReg.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Ballots Cast</p>
                    <p className="text-sm font-bold text-gray-700">{hoveredInfo.stats.totalBallots.toLocaleString()}</p>
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
        </div>
      )}
    </div>
  );
};
