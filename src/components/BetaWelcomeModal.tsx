import React from 'react';
import { ShieldCheck, MessageSquarePlus } from 'lucide-react';
import { motion } from 'motion/react';

interface BetaWelcomeModalProps {
  onDismiss: () => void;
}

export const BetaWelcomeModal: React.FC<BetaWelcomeModalProps> = ({ onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-white" />
            <h2 className="text-2xl font-bold text-white">Welcome, Beta User!</h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5 text-gray-700 text-sm leading-relaxed">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="text-blue-600 mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold text-gray-900">Active Security Maintenance:</span>{' '}
              This tool is under ongoing security review and maintenance. Updates are applied
              consistently to protect your data and improve reliability — so you can focus on the
              work that matters.
            </p>
          </div>

          <div className="flex gap-3">
            <MessageSquarePlus size={20} className="text-blue-600 mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold text-gray-900">We want your feedback!</span>{' '}
              If you have special requests, spot any issues with the data, or encounter anything
              unexpected, please reach out. Your input directly shapes how this tool evolves.
              Send requests or bug reports to{' '}
              <a
                href="mailto:jbptvconsultancygroup@gmail.com"
                className="text-blue-600 underline hover:text-blue-800"
              >
                jbptvconsultancygroup@gmail.com
              </a>
              .
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-900 text-xs">
            Thank you for being a Beta user. Your participation helps build a better tool for
            every field organizer across all 100 NC counties.
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-8 py-4 rounded-b-2xl flex justify-end">
          <button
            onClick={onDismiss}
            className="px-8 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Got it, let's go!
          </button>
        </div>
      </motion.div>
    </div>
  );
};
