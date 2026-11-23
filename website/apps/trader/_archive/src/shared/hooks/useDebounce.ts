import { useState, useEffect } from 'react';

/**
 * Debounce a rapidly-changing value.
 * @param value The raw value to debounce.
 * @param delayMs Debounce window in milliseconds (default 300).
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
