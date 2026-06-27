'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UIContext = createContext(null);

const getDefaultActiveRole = (roles) => {
  if (!roles || roles.length === 0) return '';
  const rolePriority = ['staff', 'pemimpin', 'admin_bidang', 'perencana', 'admin'];
  for (const r of rolePriority) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
};

export function UIProvider({ children }) {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState('');
  const [activeBidang, setActiveBidang] = useState('');
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [isReady, setIsReady] = useState(false);

  // Baca preferensi dari localStorage saat pertama kali load
  useEffect(() => {
    const savedRole   = localStorage.getItem('activeRole');
    const savedBidang = localStorage.getItem('activeBidang');
    const savedYear   = localStorage.getItem('activeYear');
    if (savedRole)   setActiveRole(savedRole);
    if (savedBidang) setActiveBidang(savedBidang);
    if (savedYear)   setActiveYear(parseInt(savedYear));
    setIsReady(true);
  }, []);

  // Set default preferensi saat user login (dan belum ada preferensi tersimpan)
  useEffect(() => {
    if (isReady && user) {
      if (!localStorage.getItem('activeRole')) {
        const defaultRole = getDefaultActiveRole(user.roles);
        setActiveRole(defaultRole);
        localStorage.setItem('activeRole', defaultRole);
      }
      if (!localStorage.getItem('activeBidang')) {
        const defaultBidang = user.bidangs?.[0] || '';
        setActiveBidang(defaultBidang);
        localStorage.setItem('activeBidang', defaultBidang);
      }
      if (!localStorage.getItem('activeYear')) {
        const currentYear = new Date().getFullYear();
        setActiveYear(currentYear);
        localStorage.setItem('activeYear', currentYear.toString());
      }
    }
  }, [user, isReady]);

  if (!isReady) {
    return null;
  }

  const switchRole = (role) => {
    setActiveRole(role);
    localStorage.setItem('activeRole', role);
  };

  const switchBidang = (bidang) => {
    setActiveBidang(bidang);
    localStorage.setItem('activeBidang', bidang);
  };

  const switchYear = (year) => {
    setActiveYear(parseInt(year));
    localStorage.setItem('activeYear', year.toString());
  };

  const updateCurrentUserBidang = (newBidang, { setUser, simulatedUser, setSimulatedUser }) => {
    if (simulatedUser) {
      const updated = { ...simulatedUser, bidangs: [newBidang] };
      setSimulatedUser(updated);
      localStorage.setItem('simulatedUser', JSON.stringify(updated));
    } else if (setUser) {
      setUser(prev => {
        const updated = { ...prev, bidangs: [newBidang] };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
    }
    switchBidang(newBidang);
  };

  return (
    <UIContext.Provider value={{
      activeRole, setActiveRole,
      activeBidang, setActiveBidang,
      activeYear,
      switchRole,
      switchBidang,
      switchYear,
      updateCurrentUserBidang,
      getDefaultActiveRole,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
