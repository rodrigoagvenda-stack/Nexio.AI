'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initial = saved || system;
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <button
      onClick={toggle}
      title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
      className="relative flex items-center w-14 h-7 rounded-full bg-muted border border-border p-0.5 transition-colors duration-200 flex-shrink-0"
    >
      {/* track fill */}
      <span className={`absolute inset-0 rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-primary/20' : 'bg-amber-400/20'}`} />
      {/* icons */}
      <Sun className={`relative z-10 h-3.5 w-3.5 ml-0.5 transition-colors duration-200 ${theme === 'light' ? 'text-amber-500' : 'text-muted-foreground/40'}`} />
      <Moon className={`relative z-10 h-3.5 w-3.5 ml-auto mr-0.5 transition-colors duration-200 ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground/40'}`} />
      {/* thumb */}
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-card border border-border shadow-sm transition-all duration-200 ${theme === 'dark' ? 'left-[calc(100%-26px)]' : 'left-0.5'}`} />
    </button>
  );
}
