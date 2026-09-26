import { useMemo } from 'react';

import { useSavings } from '@/store/SavingsContext';
import { computeProgress } from './progress';

/** Streak, achievements, XP and pet state for the active nest. */
export function useProgress() {
  const { couple } = useSavings();
  return useMemo(() => computeProgress(couple), [couple]);
}
