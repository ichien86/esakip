'use client';

import { AuthProvider } from './AuthContext';
import { MetadataProvider } from './MetadataContext';
import { UIProvider } from './UIContext';
import { SimulationProvider } from './SimulationInternalContext';

/**
 * AppProviders — Wraps children dengan semua context yang dibutuhkan aplikasi.
 * Urutan nesting penting: Auth → Metadata → UI → Simulation
 */
export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <MetadataProvider>
        <UIProvider>
          <SimulationProvider>
            {children}
          </SimulationProvider>
        </UIProvider>
      </MetadataProvider>
    </AuthProvider>
  );
}
