import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'theme-saas-ivory' | 'theme-indigo' | 'theme-aurora' | 'dark';

const THEME_KEY = 'insights_theme';

export const THEME_LIST: { id: ThemeId; label: string; preview: string }[] = [
  { id: 'theme-saas-ivory', label: 'Claude (Ivory)', preview: '#F5F0E8' },
  { id: 'theme-indigo', label: 'Indigo Light', preview: '#EEF2FF' },
  { id: 'theme-aurora', label: 'Aurora (Blue → Purple)', preview: 'linear-gradient(135deg,#c7f0ff,#e8d6ff)' },
  { id: 'dark', label: 'Dark', preview: '#0B1221' },
];

const ThemeContext = createContext<any>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'theme-saas-ivory';
    const stored = localStorage.getItem(THEME_KEY) as ThemeId | null;
    return stored || 'theme-saas-ivory';
  });

  useEffect(() => {
    const root = document.documentElement;
    const themeClasses = THEME_LIST.map(t => t.id).concat(['dark']);
    // remove any existing theme classes
    root.classList.remove(...themeClasses);
    // add selected theme class
    root.classList.add(theme);
    root.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => {
      const stored = localStorage.getItem(THEME_KEY) as ThemeId | null;
      if (stored && stored !== theme) {
        setThemeState(stored);
      }
    };

    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, [theme]);

  const setTheme = (id: ThemeId) => setThemeState(id);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEME_LIST }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export default ThemeContext;
