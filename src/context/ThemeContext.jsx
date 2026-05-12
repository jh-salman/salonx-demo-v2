import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  applySalonxPrimaryTheme,
  normalizePrimaryHex,
  PRIMARY_STORAGE_KEY,
  readStoredPrimaryHex,
} from '../theme/primaryTheme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [primaryHex, setPrimaryHexState] = useState(() => readStoredPrimaryHex());

  useEffect(() => {
    applySalonxPrimaryTheme(primaryHex);
  }, [primaryHex]);

  useEffect(() => {
    const onV2Admin = () => {
      setPrimaryHexState(readStoredPrimaryHex());
    };
    window.addEventListener('salonx:v2admin-theme', onV2Admin);
    return () => window.removeEventListener('salonx:v2admin-theme', onV2Admin);
  }, []);

  const setPrimaryHex = useCallback((hex) => {
    const next = normalizePrimaryHex(hex);
    try {
      localStorage.setItem(PRIMARY_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
    applySalonxPrimaryTheme(next);
    setPrimaryHexState(next);
  }, []);

  const value = useMemo(
    () => ({ primaryHex, setPrimaryHex }),
    [primaryHex, setPrimaryHex],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
