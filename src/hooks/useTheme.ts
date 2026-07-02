import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'mimo';

const themes: Theme[] = ['dark', 'mimo'];

function getSavedTheme(): Theme {
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  return savedTheme && themes.includes(savedTheme) ? savedTheme : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getSavedTheme);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark', 'mimo');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'mimo' : 'dark');
  };

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isMimo: theme === 'mimo',
  };
} 
