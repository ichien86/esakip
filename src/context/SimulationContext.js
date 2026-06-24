'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const SimulationContext = createContext();

const getDefaultActiveRole = (roles) => {
  if (!roles || roles.length === 0) return '';
  const rolePriority = ['staff', 'pemimpin', 'admin_bidang', 'perencana', 'admin'];
  for (const r of rolePriority) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
};

export function SimulationProvider({ children }) {
  const [user, setUser] = useState(null);
  const [simulatedUser, setSimulatedUser] = useState(null);
  const [activeRole, setActiveRole] = useState('');
  const [activeBidang, setActiveBidang] = useState('');
  const [allEmployees, setAllEmployees] = useState([]);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [systemSettings, setSystemSettings] = useState({ renstra_locked: false, renja_locked: false });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedSimulatedUser = localStorage.getItem('simulatedUser');
    const savedRole = localStorage.getItem('activeRole');
    const savedBidang = localStorage.getItem('activeBidang');
    const savedYear = localStorage.getItem('activeYear');

    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      const timer = setTimeout(() => {
        setUser(parsedUser);
        
        if (savedSimulatedUser) {
          setSimulatedUser(JSON.parse(savedSimulatedUser));
        }
        if (savedRole) {
          setActiveRole(savedRole);
        } else {
          setActiveRole(getDefaultActiveRole(parsedUser.roles));
        }
        if (savedBidang) {
          setActiveBidang(savedBidang);
        } else {
          setActiveBidang(parsedUser.bidangs[0] || '');
        }
        if (savedYear) {
          setActiveYear(parseInt(savedYear));
        }
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const refreshMetadata = useCallback(async () => {
    try {
      const empRes = await fetch('/api/employees');
      if (empRes.ok) {
        const emps = await empRes.json();
        setAllEmployees(emps);
      }
      const setRes = await fetch('/api/settings');
      if (setRes.ok) {
        const settings = await setRes.json();
        setSystemSettings(settings);
      }
    } catch (e) {
      console.error('Failed to load metadata', e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        refreshMetadata();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, refreshMetadata]);

  const login = async (nip, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nip, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      const defaultRole = getDefaultActiveRole(data.user.roles);
      setUser(data.user);
      setActiveRole(defaultRole);
      setActiveBidang(data.user.bidangs[0] || '');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('activeRole', defaultRole);
      localStorage.setItem('activeBidang', data.user.bidangs[0] || '');
      
      const currentYear = new Date().getFullYear();
      setActiveYear(currentYear);
      localStorage.setItem('activeYear', currentYear.toString());
      
      router.push('/dashboard');
      return { success: true };
    } else {
      const errorData = await res.json();
      return { success: false, error: errorData.error || 'Login gagal' };
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setSimulatedUser(null);
    setActiveRole('');
    setActiveBidang('');
    localStorage.removeItem('user');
    localStorage.removeItem('simulatedUser');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('activeBidang');
    router.push('/login');
  };

  const simulate = (employeeId) => {
    if (!user) return;
    if (!employeeId || employeeId === user.id) {
      const defaultRole = getDefaultActiveRole(user.roles);
      setSimulatedUser(null);
      localStorage.removeItem('simulatedUser');
      setActiveRole(defaultRole);
      setActiveBidang(user.bidangs[0] || '');
      localStorage.setItem('activeRole', defaultRole);
      localStorage.setItem('activeBidang', user.bidangs[0] || '');
    } else {
      const emp = allEmployees.find(e => e.id === employeeId);
      if (emp) {
        setSimulatedUser(emp);
        localStorage.setItem('simulatedUser', JSON.stringify(emp));
        const defaultRole = getDefaultActiveRole(emp.roles);
        setActiveRole(defaultRole);
        setActiveBidang(emp.bidangs[0] || '');
        localStorage.setItem('activeRole', defaultRole);
        localStorage.setItem('activeBidang', emp.bidangs[0] || '');
      }
    }
  };

  const switchRole = (role) => {
    setActiveRole(role);
    localStorage.setItem('activeRole', role);
  };

  const switchBidang = (bidang) => {
    setActiveBidang(bidang);
    localStorage.setItem('activeBidang', bidang);
  };

  const updateCurrentUserBidang = (newBidang) => {
    if (simulatedUser) {
      const updated = { ...simulatedUser, bidangs: [newBidang] };
      setSimulatedUser(updated);
      localStorage.setItem('simulatedUser', JSON.stringify(updated));
    } else if (user) {
      const updated = { ...user, bidangs: [newBidang] };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
    switchBidang(newBidang);
  };

  const switchYear = (year) => {
    setActiveYear(parseInt(year));
    localStorage.setItem('activeYear', year);
  };

  const fetchWithAuth = async (url, options = {}) => {
    const activeUser = simulatedUser || user;
    const headers = {
      ...(options.headers || {}),
      'x-requester-id': activeUser ? activeUser.id : '',
      'x-requester-role': activeRole,
      'x-requester-bidang': activeBidang,
      'x-requester-year': activeYear.toString()
    };
    if (options.body && options.body instanceof FormData) {
      // Let browser set content-type with boundary automatically
    } else {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, {
      ...options,
      headers
    });
  };

  const currentUser = simulatedUser || user;
  const isSimulating = !!simulatedUser;

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, pathname, loading, router]);

  return (
    <SimulationContext.Provider value={{
      user,
      simulatedUser,
      currentUser,
      activeRole,
      activeBidang,
      activeYear,
      isSimulating,
      allEmployees,
      systemSettings,
      loading,
      login,
      logout,
      simulate,
      switchRole,
      switchBidang,
      updateCurrentUserBidang,
      switchYear,
      fetchWithAuth,
      refreshMetadata
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  return useContext(SimulationContext);
}
