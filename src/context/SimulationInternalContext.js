'use client';

import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { useMetadata } from './MetadataContext';
import { useUI } from './UIContext';

const SimulationInternalContext = createContext(null);

export function SimulationProvider({ children }) {
  const { user } = useAuth();
  const { allEmployees } = useMetadata();
  const { switchRole, switchBidang, getDefaultActiveRole } = useUI();
  const [simulatedUser, setSimulatedUser] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('simulatedUser');
      if (saved) {
        try { return JSON.parse(saved); } catch { return null; }
      }
    }
    return null;
  });

  const simulate = (employeeId) => {
    if (!user) return;
    if (!employeeId || employeeId === user.id) {
      // Kembali ke user asli
      setSimulatedUser(null);
      localStorage.removeItem('simulatedUser');
      const defaultRole = getDefaultActiveRole(user.roles);
      switchRole(defaultRole);
      switchBidang(user.bidangs?.[0] || '');
      localStorage.setItem('activeRole', defaultRole);
      localStorage.setItem('activeBidang', user.bidangs?.[0] || '');
    } else {
      const emp = allEmployees.find(e => e.id === employeeId);
      if (emp) {
        setSimulatedUser(emp);
        localStorage.setItem('simulatedUser', JSON.stringify(emp));
        const defaultRole = getDefaultActiveRole(emp.roles);
        switchRole(defaultRole);
        switchBidang(emp.bidangs?.[0] || '');
        localStorage.setItem('activeRole', defaultRole);
        localStorage.setItem('activeBidang', emp.bidangs?.[0] || '');
      }
    }
  };

  const currentUser = simulatedUser || user;
  const isSimulating = !!simulatedUser;

  return (
    <SimulationInternalContext.Provider value={{
      simulatedUser,
      setSimulatedUser,
      currentUser,
      isSimulating,
      simulate,
    }}>
      {children}
    </SimulationInternalContext.Provider>
  );
}

export function useSimulationInternal() {
  const ctx = useContext(SimulationInternalContext);
  if (!ctx) throw new Error('useSimulationInternal must be used within SimulationProvider');
  return ctx;
}
