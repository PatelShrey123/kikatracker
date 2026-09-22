import { useEffect, useState } from 'react';

const STORAGE_KEY = 'xpert_cursor_mode';

export type CursorMode = 'custom' | 'system';

/** Touch devices never get the fancy cursor, so they should not be nagged with a toggle either. */
export const supportsCustomCursor = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
};

const read = (): CursorMode => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'system' ? 'system' : 'custom';
  } catch {
    return 'custom';
  }
};

/**
 * Remembers whether the visitor wants the React Bits target cursor or their own system pointer.
 * The choice is kept in localStorage so it survives reloads and tab changes.
 */
export function useCursorMode() {
  const [mode, setMode] = useState<CursorMode>(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* private mode — the choice just will not stick */
    }
    document.documentElement.dataset.cursorMode = mode;
  }, [mode]);

  // keep other tabs of the site in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMode(e.newValue === 'system' ? 'system' : 'custom');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    cursorMode: mode,
    isCustomCursor: mode === 'custom',
    toggleCursorMode: () => setMode((m) => (m === 'custom' ? 'system' : 'custom')),
  };
}
