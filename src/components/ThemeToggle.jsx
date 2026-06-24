'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder button to avoid layout shift before hydration
    return (
      <button className="theme-toggle-btn" aria-label="Toggle theme">
        <div style={{ width: 16, height: 16 }} />
      </button>
    );
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const getIcon = () => {
    if (resolvedTheme === 'dark') return <Moon size={16} />;
    return <Sun size={16} />;
  };

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={`Tema Saat Ini: ${theme}. Klik untuk mengubah.`}
      aria-label="Toggle theme"
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid var(--glass-border)',
        borderRadius: '6px',
        color: 'var(--text-primary)',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      {getIcon()}
    </button>
  );
}
