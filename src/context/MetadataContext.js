'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const MetadataContext = createContext(null);

export function MetadataProvider({ children }) {
  const { user, logout } = useAuth();
  const [allEmployees, setAllEmployees] = useState([]);
  const [systemSettings, setSystemSettings] = useState({
    renstra_locked: false,
    renja_locked: false,
  });

  const refreshMetadata = useCallback(async () => {
    try {
      let empRes, setRes;
      try {
        [empRes, setRes] = await Promise.all([
          fetch('/api/employees', { credentials: 'include' }),
          fetch('/api/settings', { credentials: 'include' }),
        ]);
      } catch (err) {
        console.error('Network error in MetadataContext:', err);
        return;
      }
      
      if (empRes.status === 401 || setRes.status === 401) {
        console.warn('Session expired. Logging out from Metadata...');
        logout();
        return;
      }

      if (empRes.ok) setAllEmployees(await empRes.json());
      if (setRes.ok) setSystemSettings(await setRes.json());
    } catch (e) {
      console.error('Failed to load metadata', e);
    }
  }, []);

  // Muat metadata hanya setelah user login
  useEffect(() => {
    if (user) {
      refreshMetadata();
    } else {
      // Reset saat logout
      setAllEmployees([]);
      setSystemSettings({ renstra_locked: false, renja_locked: false });
    }
  }, [user, refreshMetadata]);

  return (
    <MetadataContext.Provider value={{ allEmployees, systemSettings, refreshMetadata }}>
      {children}
    </MetadataContext.Provider>
  );
}

export function useMetadata() {
  const ctx = useContext(MetadataContext);
  if (!ctx) throw new Error('useMetadata must be used within MetadataProvider');
  return ctx;
}
