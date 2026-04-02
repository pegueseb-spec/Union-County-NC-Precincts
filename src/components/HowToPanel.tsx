import React from 'react';
import { AlertCircle, Users } from 'lucide-react';

export function HowToPanel() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm prose prose-blue max-w-none">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Union County Voter Intelligence Dashboard</h2>

        <section className="space-y-4">
          <h3 className="text-xl font-bold text-blue-600">What this application provides</h3>
          <p className="text-gray-600 leading-relaxed">
            This dashboard is a specialized tool for field organizers in Union County, North Carolina. It synthesizes raw demographic and turnout data to provide actionable intelligence at the precinct level. By comparing registration numbers with actual ballots cast, organizers can identify critical engagement gaps and track shifting political landscapes.
          </p>
        </section>

        <section className="space-y-4 mt-8">
          <h3 className="text-xl font-bold text-blue-600">Built-In Data and Optional Upload Overrides</h3>
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
            <div className="flex gap-4">
              <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <p className="font-bold">Start with Built-In Data</p>
                <p className="text-sm text-gray-600">The dashboard now loads Union County precinct election data into application memory automatically, so you can analyze immediately.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <p className="font-bold">Upload Optional Replacements</p>
                <p className="text-sm text-gray-600">If you have fresher NCSBE extracts, use the upload tab to replace built-in voter, history, or CVAP records. The app still filters to Union County.</p>
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
    </div>
  );
}