'use client';
import * as React from 'react';

import { useAuth } from './AuthContext';
import { useMetadata } from './MetadataContext';
import { useUI } from './UIContext';
import { useSimulationInternal } from './SimulationInternalContext';

/**
 * useFetchWithAuth — Custom hook yang menggabungkan semua context
 * untuk menghasilkan fungsi fetchWithAuth yang menyisipkan header auth.
 */
export function useFetchWithAuth() {
  const { user, logout } = useAuth();
  const { activeRole, activeBidang, activeYear } = useUI();
  const { simulatedUser } = useSimulationInternal();

  const fetchWithAuth = React.useCallback(async (url, options = {}) => {
    const activeUser = simulatedUser || user;
    const headers = {
      ...(options.headers || {}),
      'x-requester-id':     activeUser ? activeUser.id : '',
      'x-requester-role':   activeRole,
      'x-requester-bidang': activeBidang,
      'x-requester-year':   activeYear.toString(),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers,
      });
    } catch (error) {
      console.warn(`Network error fetching ${url}: ${error.message}`);
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Network error or CORS issue' })
      };
    }

    if (response.status === 401) {
      console.warn('Session expired. Logging out...');
      logout();
    }

    return response;
  }, [user, logout, activeRole, activeBidang, activeYear, simulatedUser]);

  return { fetchWithAuth };
}
