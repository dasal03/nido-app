import { useCallback, useState } from 'react';

import { useT } from '@/providers/Preferences';
import { BackendError } from '@/services/backend';

/** Wraps an async backend call with loading and translated, user-facing error state. */
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: A) => {
      setLoading(true);
      setError(null);
      try {
        await fn(...args);
        return true;
      } catch (e) {
        setError(t(e instanceof BackendError ? e.key : 'errors.generic'));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [fn, t],
  );

  return { run, loading, error, setError };
}
