import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { storage } from '@/src/utils/storage';

type ThemeMode = 'light' | 'dark';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  shadow: string;
  statusAman: string;
  statusAgakPanas: string;
  statusRemDikit: string;
  statusBoncos: string;
};

type ThemeContextType = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const lightColors: ThemeColors = {
  background: '#F4F4F4',
  card: '#FFFFFF',
  text: '#111111',
  textSecondary: '#666666',
  border: '#111111',
  shadow: '#111111',
  statusAman: '#A3E635',
  statusAgakPanas: '#FDE047',
  statusRemDikit: '#FB923C',
  statusBoncos: '#EF4444',
};

const darkColors: ThemeColors = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#FDFDFD',
  textSecondary: '#94A3B8',
  border: '#FDFDFD',
  shadow: '#FDFDFD',
  statusAman: '#A3E635',
  statusAgakPanas: '#FDE047',
  statusRemDikit: '#FB923C',
  statusBoncos: '#EF4444',
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkColors,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const THEME_KEY = 'boncos_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem(THEME_KEY, 'dark');
      if (saved === 'light' || saved === 'dark') setMode(saved);
    })();
  }, []);

  const toggleTheme = useCallback(async () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      storage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors;

  const value = useMemo(() => ({ mode, colors, toggleTheme }), [mode, colors, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
