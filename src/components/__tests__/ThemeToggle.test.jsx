import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { useTheme } from 'next-themes';
import { vi } from 'vitest';

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle Component', () => {
  const setThemeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly after mounting with system theme', () => {
    useTheme.mockReturnValue({
      theme: 'system',
      setTheme: setThemeMock,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /toggle theme/i });
    expect(button).toBeDefined();
    // System theme defaults to Monitor icon
  });

  it('toggles to light when theme is system', () => {
    useTheme.mockReturnValue({
      theme: 'system',
      setTheme: setThemeMock,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(button);

    expect(setThemeMock).toHaveBeenCalledWith('light');
  });

  it('toggles to dark when theme is light', () => {
    useTheme.mockReturnValue({
      theme: 'light',
      setTheme: setThemeMock,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(button);

    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });

  it('toggles to system when theme is dark', () => {
    useTheme.mockReturnValue({
      theme: 'dark',
      setTheme: setThemeMock,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(button);

    expect(setThemeMock).toHaveBeenCalledWith('system');
  });
});
