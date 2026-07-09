'use client';

import React from 'react';
import { useMetadata } from '@/context/MetadataContext';
import { useSimulationInternal } from '@/context/SimulationInternalContext';
import { useAuth } from '@/context/AuthContext';

export default function OrganogramPage() {
  const { allEmployees } = useMetadata();
  const { simulate, currentUser } = useSimulationInternal();
  const { user } = useAuth();
  const buildTree = (parentId) => {
    const children = allEmployees.filter(emp => emp.parentId === parentId && emp.id !== 'admin' && emp.isActive !== false);
    if (children.length === 0) return null;

    const useVertical = children.length > 3;

    return (
      <ul className={useVertical ? 'vertical-layout' : ''}>
        {children.map(emp => (
          <li key={emp.id}>
            <div
              className="org-node"
              style={{
                border: currentUser?.id === emp.id ? '2px solid var(--primary-orange)' : '',
                boxShadow: currentUser?.id === emp.id ? '0 0 15px rgba(255, 107, 0, 0.4)' : ''
              }}
            >
              <h4>{emp.nama}</h4>
              <p>{emp.jabatan}</p>
              {emp.pltBidangs && emp.pltBidangs.length > 0 && (
                <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                  <span className="badge" style={{ background: 'rgba(255,107,0,0.15)', color: 'var(--primary-orange)', fontSize: '10px', border: '1px solid rgba(255,107,0,0.3)' }}>
                    Plt: {emp.pltBidangs.join(', ')}
                  </span>
                </div>
              )}
              <span className="text-muted" style={{ fontSize: '9px' }}>NIP: {emp.nip}</span>
            </div>
            {buildTree(emp.id)}
          </li>
        ))}
      </ul>
    );
  };

  const rootEmployee = allEmployees.find(emp => emp.parentId === null && emp.id !== 'admin' && emp.isActive !== false);

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-sitemap text-orange"></i> Visualisasi Hierarki Organisasi BPBD Boyolali</h3>
        <p className="text-muted">Diagram struktur organisasi BPBD Kabupaten Boyolali.</p>
      </div>
      <div className="panel-body org-chart-container">
        <div className="org-tree">
          {rootEmployee ? (
            <ul>
              <li>
                <div
                  className="org-node"
                  style={{
                    border: currentUser?.id === rootEmployee.id ? '2px solid var(--primary-orange)' : '',
                    boxShadow: currentUser?.id === rootEmployee.id ? '0 0 15px rgba(255, 107, 0, 0.4)' : ''
                  }}
                >
                  <h4>{rootEmployee.nama}</h4>
                  <p>{rootEmployee.jabatan}</p>
                  {rootEmployee.pltBidangs && rootEmployee.pltBidangs.length > 0 && (
                    <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                      <span className="badge" style={{ background: 'rgba(255,107,0,0.15)', color: 'var(--primary-orange)', fontSize: '10px', border: '1px solid rgba(255,107,0,0.3)' }}>
                        Plt: {rootEmployee.pltBidangs.join(', ')}
                      </span>
                    </div>
                  )}
                  <span className="text-muted" style={{ fontSize: '9px' }}>NIP: {rootEmployee.nip}</span>
                </div>
                {buildTree(rootEmployee.id)}
              </li>
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Memuat bagan organisasi...</p>
          )}
        </div>
      </div>
    </div>
  );
}
