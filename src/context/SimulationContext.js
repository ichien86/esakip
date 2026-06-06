'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const SimulationContext = createContext();

export function SimulationProvider({ children }) {
  const [user, setUser] = useState(null);
  const [simulatedUser, setSimulatedUser] = useState(null);
  const [activeRole, setActiveRole] = useState('');
  const [activeBidang, setActiveBidang] = useState('');
  const [allEmployees, setAllEmployees] = useState([]);
  const [activeYear, setActiveYear] = useState(2026);
  const [systemSettings, setSystemSettings] = useState({ planning_locked: false });
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
      setUser(parsedUser);
      
      if (savedSimulatedUser) {
        setSimulatedUser(JSON.parse(savedSimulatedUser));
      }
      if (savedRole) {
        setActiveRole(savedRole);
      } else {
        setActiveRole(parsedUser.roles[0] || '');
      }
      if (savedBidang) {
        setActiveBidang(savedBidang);
      } else {
        setActiveBidang(parsedUser.bidangs[0] || '');
      }
      if (savedYear) {
        setActiveYear(parseInt(savedYear));
      }
    }
    setLoading(false);
  }, []);

  const refreshMetadata = async () => {
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
  };

  useEffect(() => {
    if (user) {
      refreshMetadata();
    }
  }, [user]);

  const login = async (nip, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nip, password })
    });
    
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setActiveRole(data.user.roles[0] || '');
      setActiveBidang(data.user.bidangs[0] || '');
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('activeRole', data.user.roles[0] || '');
      localStorage.setItem('activeBidang', data.user.bidangs[0] || '');
      
      router.push('/dashboard');
      return { success: true };
    } else {
      const errorData = await res.json();
      return { success: false, error: errorData.error || 'Login gagal' };
    }
  };

  const logout = () => {
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
      setSimulatedUser(null);
      localStorage.removeItem('simulatedUser');
      setActiveRole(user.roles[0] || '');
      setActiveBidang(user.bidangs[0] || '');
      localStorage.setItem('activeRole', user.roles[0] || '');
      localStorage.setItem('activeBidang', user.bidangs[0] || '');
    } else {
      const emp = allEmployees.find(e => e.id === employeeId);
      if (emp) {
        setSimulatedUser(emp);
        localStorage.setItem('simulatedUser', JSON.stringify(emp));
        setActiveRole(emp.roles[0] || '');
        setActiveBidang(emp.bidangs[0] || '');
        localStorage.setItem('activeRole', emp.roles[0] || '');
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

  const switchYear = (year) => {
    setActiveYear(parseInt(year));
    localStorage.setItem('activeYear', year);
  };

  const fetchWithAuth = async (url, options = {}) => {
    const activeUser = simulatedUser || user;
    const headers = {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      'x-requester-id': activeUser ? activeUser.id : '',
      'x-requester-role': activeRole,
      'x-requester-bidang': activeBidang,
      'x-requester-year': activeYear.toString()
    };
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
  }, [user, pathname, loading]);

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
