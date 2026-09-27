import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  isLoading: boolean;
}

/**
 * A brief hold on the wordmark while the first paint settles, then out of the way.
 *
 * This used to run a 4.8 second timer against a fake percentage counter. Nothing was being
 * waited on - the catalog loads in the background and the app renders without it - so the
 * number was decoration and the delay was a toll every visitor paid. Now it is short, and it
 * shows no progress figure, because there is no progress to report.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading }) => (
  <AnimatePresence>
    {isLoading && (
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
        className="fixed inset-0 bg-obsidian-deep z-50 flex items-center justify-center"
      >
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}kikatracker_mascot.png`}
            alt=""
            className="w-7 h-7 rounded-md"
          />
          <span className="text-[15px] font-semibold tracking-tight text-[#EDEDED]">XPERT</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
