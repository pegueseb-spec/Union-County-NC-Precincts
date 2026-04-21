import React, { useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

interface LicenseAcceptanceModalProps {
  onAccept: () => void;
}

export const LicenseAcceptanceModal: React.FC<LicenseAcceptanceModalProps> = ({ onAccept }) => {
  const [expanded, setExpanded] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (accepted) {
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6 rounded-t-2xl">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={28} className="text-white" />
            <h1 className="text-2xl font-bold text-white">License Agreement</h1>
          </div>
          <p className="text-red-100 text-sm">
            You must accept the terms below to access this application.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Quick Summary */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="font-bold text-red-900 mb-3">⚠️ Proprietary Software</h2>
            <p className="text-sm text-red-800 leading-relaxed">
              This software is owned by <strong>JBPTV Consultancy Group</strong>.
              Unauthorized reverse engineering, duplication, or adaptation of this system
              without express written permission is <strong>strictly prohibited</strong> and
              will result in legal action.
            </p>
          </div>

          {/* Expandable Full License */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-lg mb-4 transition-colors"
          >
            <span className="font-semibold text-gray-900">Read Full License Terms</span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={20} className="text-gray-600" />
            </motion.div>
          </button>

          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">1. OWNERSHIP</h3>
                <p>
                  This software, including all source code, documentation, and methodology,
                  is the sole and exclusive property of JBPTV Consultancy Group.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">2. AUTHORIZED USE</h3>
                <p>
                  This software is provided solely for authorized use by field organizers and
                  campaign staff designated by JBPTV Consultancy Group or its clients.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">3. STRICT RESTRICTIONS</h3>
                <p className="font-semibold text-red-700 mb-1">You may NOT:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Reverse engineer or decompile this application</li>
                  <li>Duplicate or replicate the concept or methodology</li>
                  <li>Adapt this system for other counties without authorization</li>
                  <li>Share or distribute access to unauthorized parties</li>
                  <li>Modify, fork, or create competing versions</li>
                  <li>Extract bulk data for unauthorized purposes</li>
                  <li>Use automated means to understand proprietary algorithms</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">4. PENALTIES FOR VIOLATION</h3>
                <p className="text-red-700 font-semibold">
                  Unauthorized duplication or reverse engineering will result in:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Immediate termination of access</li>
                  <li>Civil and criminal legal action</li>
                  <li>Liability for damages and legal fees</li>
                  <li>Injunctive relief to prevent further use</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-yellow-900 text-xs">
                  For the complete license terms, see the LICENSE file in the project repository.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Acceptance Checkbox */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">I acknowledge and accept</span> the
                license terms above. I understand that unauthorized duplication, reverse engineering,
                or adaptation of this system is prohibited and will result in legal action by
                JBPTV Consultancy Group.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-4 rounded-b-2xl flex justify-end gap-3">
          <button
            disabled
            className="px-6 py-2 text-gray-500 font-semibold cursor-not-allowed opacity-50"
          >
            Exit Application
          </button>
          <button
            onClick={handleAccept}
            disabled={!accepted}
            className={`px-8 py-2 rounded-lg font-semibold transition-all ${
              accepted
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Accept & Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
};
