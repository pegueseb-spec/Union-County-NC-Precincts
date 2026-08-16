import React from 'react';
import { AlertCircle, Users, MapPinned, Target, Lightbulb, Building2, BookOpen } from 'lucide-react';

export function HowToPanel() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm prose prose-blue max-w-none">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Union County Voter Intelligence Dashboard</h2>

        <section className="space-y-4">
          <h3 className="text-xl font-bold text-blue-600">Mission and Practical Value</h3>
          <p className="text-gray-600 leading-relaxed">
            This dashboard turns precinct-level voter registration and turnout files into a field-ready intelligence view. It helps teams prioritize where outreach can produce the largest measurable gain by highlighting turnout gaps, registration pressure versus CVAP, and demographic composition shifts.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
            <p className="m-0 font-semibold flex items-center gap-2"><AlertCircle size={16} /> Methodology Note</p>
            <p className="mt-2 mb-0">
              Turnout % in this app is calculated from NCSBE ENRS files as ballots from <span className="font-semibold">history_stats</span> divided by registered voters from <span className="font-semibold">voter_stats</span> for the selected year and precinct scope. Official NCSBE web views may use different denominator definitions or publication cuts, which can make percentages look different even when source files match.
            </p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
            <p className="m-0 font-semibold flex items-center gap-2"><Building2 size={16} /> Developed by JBPTV Consultancy Group</p>
            <p className="mt-2 mb-0">Concept and implementation are designed as a scalable template for expansion from Union County to all 100 North Carolina counties.</p>
          </div>
        </section>

        <section className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-blue-600">Quick Start Workflow</h3>
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
            <div className="flex gap-4">
              <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <p className="font-bold">Open Dashboard Immediately</p>
                <p className="text-sm text-gray-600">Built-in Union County data loads automatically, so you can start analysis with no setup.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <p className="font-bold">Use Year and Precinct Filters</p>
                <p className="text-sm text-gray-600">Set election year, then focus precincts from the dropdown or directly from the map.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
              <div>
                <p className="font-bold">Review Map + Insight Panel Together</p>
                <p className="text-sm text-gray-600">Hover to inspect context and click to lock a precinct so the side panel shows focused diagnostics.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">4</div>
              <div>
                <p className="font-bold">Export for Field Execution</p>
                <p className="text-sm text-gray-600">Export summary and precinct CSV files for canvassing plans, presentations, and partner briefings.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-blue-600">Interpretation Playbook</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose">
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
            <div className="border border-gray-100 p-5 rounded-xl bg-emerald-50/30">
              <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                <MapPinned size={18} />
                Geo-Targeting Priority
              </h4>
              <p className="text-sm text-gray-700 mt-2">
                Favor precincts with high registration totals but below-average turnout. These zones usually create the strongest return on volunteer time and digital persuasion spend.
              </p>
            </div>
            <div className="border border-gray-100 p-5 rounded-xl bg-amber-50/30">
              <h4 className="font-bold text-amber-900 flex items-center gap-2">
                <Target size={18} />
                CVAP Pressure Signals
              </h4>
              <p className="text-sm text-gray-700 mt-2">
                Track Registered/CVAP and Ballots/CVAP side by side. If Registered/CVAP is high but Ballots/CVAP lags, persuasion and turnout operations are both needed.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <BookOpen size={20} />
            Community Glossary (Tiered)
          </h3>
          <p className="text-gray-600 leading-relaxed">
            Each term is written in three layers so volunteers, team leads, and analysts can work from one shared language.
            Every entry also includes why the term matters for community building and organizing strategy.
          </p>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 not-prose">
            <p className="text-xs uppercase tracking-wider font-bold text-blue-800">Glossary Quick Jump</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="#glossary-turnout" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-100">Turnout %</a>
              <a href="#glossary-density" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-100">Registration Density</a>
              <a href="#glossary-reg-cvap" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-100">Registered / CVAP</a>
              <a href="#glossary-ballots-cvap" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-100">Ballots / CVAP</a>
              <a href="#glossary-opportunity" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-100">Opportunity Score</a>
              <a href="#glossary-scenario" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 border border-blue-200 hover:bg-blue-100">Scenario Lift</a>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50/70 text-blue-900">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Term</th>
                  <th className="px-4 py-3 text-left font-bold">Basic Tier (Volunteer)</th>
                  <th className="px-4 py-3 text-left font-bold">Field Tier (Organizer)</th>
                  <th className="px-4 py-3 text-left font-bold">Technical Tier (Analyst)</th>
                  <th className="px-4 py-3 text-left font-bold">Why This Matters for Community Building</th>
                </tr>
              </thead>
              <tbody>
                <tr id="glossary-turnout" className="border-t border-gray-200 align-top">
                  <td className="px-4 py-3 font-semibold text-gray-900">Turnout %</td>
                  <td className="px-4 py-3 text-gray-700">How many registered voters actually cast a ballot.</td>
                  <td className="px-4 py-3 text-gray-700">Shows where we need voter-contact follow-up and turnout chase plans.</td>
                  <td className="px-4 py-3 text-gray-700">Calculated as ballots divided by total registration for the selected scope.</td>
                  <td className="px-4 py-3 text-gray-700">Low turnout often signals participation barriers, trust gaps, or weak neighborhood engagement.</td>
                </tr>
                <tr id="glossary-density" className="border-t border-gray-200 align-top bg-gray-50/40">
                  <td className="px-4 py-3 font-semibold text-gray-900">Registration Density</td>
                  <td className="px-4 py-3 text-gray-700">How large a group is inside a precinct's registration base.</td>
                  <td className="px-4 py-3 text-gray-700">Helps decide where culturally specific outreach will have greatest return.</td>
                  <td className="px-4 py-3 text-gray-700">Group registrations divided by precinct total registrations.</td>
                  <td className="px-4 py-3 text-gray-700">Supports representation by making sure organizing resources reach communities proportionally.</td>
                </tr>
                <tr id="glossary-reg-cvap" className="border-t border-gray-200 align-top">
                  <td className="px-4 py-3 font-semibold text-gray-900">Registered / CVAP</td>
                  <td className="px-4 py-3 text-gray-700">Share of voting-age citizens who are registered.</td>
                  <td className="px-4 py-3 text-gray-700">Shows how much registration growth room still exists in each precinct.</td>
                  <td className="px-4 py-3 text-gray-700">Registration count divided by citizen voting age population for matching year/precinct.</td>
                  <td className="px-4 py-3 text-gray-700">Highlights where civic inclusion work can bring more residents into the democratic process.</td>
                </tr>
                <tr id="glossary-ballots-cvap" className="border-t border-gray-200 align-top bg-gray-50/40">
                  <td className="px-4 py-3 font-semibold text-gray-900">Ballots / CVAP</td>
                  <td className="px-4 py-3 text-gray-700">Share of voting-age citizens who actually voted.</td>
                  <td className="px-4 py-3 text-gray-700">Guides turnout operations where registration is present but participation lags.</td>
                  <td className="px-4 py-3 text-gray-700">Ballots cast divided by citizen voting age population.</td>
                  <td className="px-4 py-3 text-gray-700">Connects civic participation to neighborhood voice and policy influence.</td>
                </tr>
                <tr id="glossary-opportunity" className="border-t border-gray-200 align-top">
                  <td className="px-4 py-3 font-semibold text-gray-900">Opportunity Score</td>
                  <td className="px-4 py-3 text-gray-700">A ranking that points to precincts where outreach can move the most votes.</td>
                  <td className="px-4 py-3 text-gray-700">Used to prioritize staffing, canvassing, and targeted messaging.</td>
                  <td className="px-4 py-3 text-gray-700">Weighted composite of turnout gap, registration mass, CVAP gap, and recent decline.</td>
                  <td className="px-4 py-3 text-gray-700">Helps direct limited organizer time toward communities with highest engagement upside.</td>
                </tr>
                <tr id="glossary-scenario" className="border-t border-gray-200 align-top bg-gray-50/40">
                  <td className="px-4 py-3 font-semibold text-gray-900">Scenario Lift</td>
                  <td className="px-4 py-3 text-gray-700">A "what if" turnout increase assumption.</td>
                  <td className="px-4 py-3 text-gray-700">Used to set realistic ballot goals for volunteer plans and partner asks.</td>
                  <td className="px-4 py-3 text-gray-700">Applies a modeled turnout delta with conservative/base/aggressive confidence bands.</td>
                  <td className="px-4 py-3 text-gray-700">Turns data into shared goals communities can organize around and measure over time.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-blue-600">Advanced Insight Loop</h3>
          <div className="rounded-xl border border-gray-200 p-5 bg-gray-50 not-prose">
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
              <li>Start with countywide view at one year.</li>
              <li>Sort precincts by turnout and mark bottom-quartile candidates.</li>
              <li>Open each candidate precinct and capture top two turnout weaknesses by party and race.</li>
              <li>Export precinct CSV and attach actions: persuasion, registration, turnout chase, or poll-day logistics.</li>
              <li>Repeat each week as fresh files arrive to measure movement.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-blue-100 p-4 bg-blue-50/50 text-sm text-blue-900 not-prose">
            <p className="m-0 font-semibold">Map Power Tips</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-blue-900">
              <li>Click a precinct to auto-zoom into that area and focus insights.</li>
              <li>Use Opportunity Mode to highlight high-registration, low-turnout targets.</li>
              <li>Use Prev/Next precinct buttons or keyboard arrows to move quickly through precincts.</li>
              <li>Press Escape to clear selection and reset map focus.</li>
            </ul>
          </div>
          <p className="text-sm text-gray-600 flex items-center gap-2"><Lightbulb size={16} /> For a complete walkthrough and operating checklist, open TUTORIAL.md in the project root.</p>
        </section>
      </div>
    </div>
  );
}