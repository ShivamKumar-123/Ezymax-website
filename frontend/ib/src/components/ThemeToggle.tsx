'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getTheme, setTheme, type Theme } from '@/lib/theme';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border-primary text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
    >
      {mounted && theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
