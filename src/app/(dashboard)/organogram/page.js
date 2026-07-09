'use client';

import React, { useState, useMemo } from 'react';
import { useMetadata } from '@/context/MetadataContext';
import { useSimulationInternal } from '@/context/SimulationInternalContext';

export default function OrganogramPage() {
  const { allEmployees } = useMetadata();
  const { currentUser } = useSimulationInternal();
  const [selectedUnit, setSelectedUnit] = useState('__all__');

  const activeEmployees = useMemo(
    () => allEmployees.filter(e => e.id !== 'admin' && e.isActive !== false),
    [allEmployees]
  );

  // Kumpulkan semua unit kerja unik dari bidangs semua pegawai
  const allUnits = useMemo(() => {
    const unitSet = new Set();
    activeEmployees.forEach(emp => {
      (emp.bidangs || []).forEach(b => unitSet.add(b));
    });
    return Array.from(unitSet).sort();
  }, [activeEmployees]);

  // Render satu node pegawai
  const renderNode = (emp, isPlt = false, pltForUnit = null) => {
    const isMe = currentUser?.id === emp.id;
    return (
      <div
        className="org-node"
        style={{
          border: isMe
            ? '2px solid var(--primary-orange)'
            : isPlt
            ? '2px dashed rgba(255,107,0,0.6)'
            : '',
          boxShadow: isMe ? '0 0 15px rgba(255,107,0,0.4)' : '',
          opacity: isPlt ? 0.92 : 1,
          background: isPlt
            ? 'rgba(255,107,0,0.06)'
            : undefined,
        }}
      >
        {isPlt && (
          <div style={{ marginBottom: '4px' }}>
            <span
              style={{
                background: 'rgba(255,107,0,0.2)',
                color: 'var(--primary-orange)',
                fontSize: '10px',
                fontWeight: 700,
                border: '1px solid rgba(255,107,0,0.5)',
                borderRadius: '4px',
                padding: '1px 6px',
                letterSpacing: '0.5px',
              }}
            >
              🔶 PLT {pltForUnit}
            </span>
          </div>
        )}
        <h4 style={{ margin: 0 }}>{emp.nama}</h4>
        <p style={{ margin: '2px 0' }}>{emp.jabatan}</p>
        {isPlt && (
          <p style={{ margin: '2px 0', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Jabatan definitif di: {(emp.bidangs || []).filter(b => !(emp.pltBidangs || []).includes(b)).join(', ') || emp.bidangs?.join(', ')}
          </p>
        )}
        {!isPlt && emp.pltBidangs && emp.pltBidangs.length > 0 && (
          <div style={{ marginTop: '3px' }}>
            <span style={{ background: 'rgba(255,107,0,0.15)', color: 'var(--primary-orange)', fontSize: '9px', border: '1px solid rgba(255,107,0,0.3)', borderRadius: '4px', padding: '1px 5px' }}>
              Plt: {emp.pltBidangs.join(', ')}
            </span>
          </div>
        )}
        <span className="text-muted" style={{ fontSize: '9px' }}>NIP: {emp.nip}</span>
      </div>
    );
  };

  // ── MODE: Semua (hierarki penuh) ──────────────────────────────────────
  const buildFullTree = (parentId) => {
    const children = activeEmployees.filter(e => e.parentId === parentId);
    if (children.length === 0) return null;
    return (
      <ul className={children.length > 3 ? 'vertical-layout' : ''}>
        {children.map(emp => (
          <li key={emp.id}>
            {renderNode(emp)}
            {buildFullTree(emp.id)}
          </li>
        ))}
      </ul>
    );
  };

  const rootEmployee = activeEmployees.find(e => e.parentId === null);

  // ── MODE: Per Unit Kerja ──────────────────────────────────────────────
  const buildUnitTree = (unitName) => {
    // Kepala unit = Administrator dengan scopeLeader === unitName atau bidangs[0] === unitName
    const unitHead = activeEmployees.find(
      e => e.scopeLeader === unitName || (e.bidangs?.includes(unitName) && e.jenisJabatan === 'Administrator')
    );

    // Pegawai definitif yang bertugas di unit ini (bawahan langsung kepala unit)
    const definitifMembers = unitHead
      ? activeEmployees.filter(e => e.parentId === unitHead.id)
      : [];

    // Pegawai PLT di unit ini (yang punya pltBidangs termasuk unitName, bukan kepala unit)
    const pltMembers = activeEmployees.filter(
      e => (e.pltBidangs || []).includes(unitName) && e.id !== unitHead?.id
    );

    // Bawahan JFT/JFU di bawah kepala unit (level 2)
    const buildSubTree = (parentId) => {
      const subs = activeEmployees.filter(e => e.parentId === parentId);
      if (subs.length === 0) return null;
      return (
        <ul className={subs.length > 3 ? 'vertical-layout' : ''}>
          {subs.map(emp => (
            <li key={emp.id}>
              {renderNode(emp)}
              {buildSubTree(emp.id)}
            </li>
          ))}
        </ul>
      );
    };

    const allMembers = [...definitifMembers, ...pltMembers];

    return (
      <ul>
        {unitHead ? (
          <li>
            {renderNode(unitHead)}
            {allMembers.length > 0 && (
              <ul className={allMembers.length > 3 ? 'vertical-layout' : ''}>
                {/* Bawahan definitif + sub-bawahan mereka */}
                {definitifMembers.map(emp => (
                  <li key={emp.id}>
                    {renderNode(emp)}
                    {buildSubTree(emp.id)}
                  </li>
                ))}
                {/* PLT di unit ini */}
                {pltMembers.map(emp => (
                  <li key={`plt-${emp.id}`}>
                    {renderNode(emp, true, unitName)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ) : (
          <li>
            <div className="org-node" style={{ opacity: 0.5, fontStyle: 'italic' }}>
              <p>Belum ada Kepala {unitName}</p>
              {pltMembers.length > 0 && (
                <p style={{ fontSize: '11px', color: 'var(--primary-orange)' }}>
                  Dirangkap Plt
                </p>
              )}
            </div>
            {pltMembers.length > 0 && (
              <ul>
                {pltMembers.map(emp => (
                  <li key={`plt-${emp.id}`}>
                    {renderNode(emp, true, unitName)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    );
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-sitemap text-orange" /> Visualisasi Hierarki Organisasi BPBD Boyolali</h3>
        <p className="text-muted">Diagram struktur organisasi BPBD Kabupaten Boyolali.</p>
      </div>

      {/* Tab navigasi unit kerja */}
      <div style={{ padding: '0 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedUnit('__all__')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: selectedUnit === '__all__' ? '2px solid var(--primary-orange)' : '2px solid transparent',
            background: 'none',
            color: selectedUnit === '__all__' ? 'var(--primary-orange)' : 'var(--text-muted)',
            fontWeight: selectedUnit === '__all__' ? 700 : 400,
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'all 0.2s',
          }}
        >
          <i className="fa-solid fa-network-wired mr-1" /> Semua
        </button>
        {allUnits.map(unit => (
          <button
            key={unit}
            onClick={() => setSelectedUnit(unit)}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: selectedUnit === unit ? '2px solid var(--primary-orange)' : '2px solid transparent',
              background: 'none',
              color: selectedUnit === unit ? 'var(--primary-orange)' : 'var(--text-muted)',
              fontWeight: selectedUnit === unit ? 700 : 400,
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {unit}
          </button>
        ))}
      </div>

      <div className="panel-body org-chart-container">
        <div className="org-tree">
          {selectedUnit === '__all__' ? (
            // Tampilan hierarki penuh
            rootEmployee ? (
              <ul>
                <li>
                  {renderNode(rootEmployee)}
                  {buildFullTree(rootEmployee.id)}
                </li>
              </ul>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Memuat bagan organisasi...</p>
            )
          ) : (
            // Tampilan per unit
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-building text-orange mr-2" />
                  {selectedUnit}
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '20px', height: '2px', background: 'var(--glass-border)', display: 'inline-block' }} /> Definitif
                  <span style={{ width: '20px', height: '2px', borderTop: '2px dashed rgba(255,107,0,0.6)', display: 'inline-block' }} /> Plt
                </span>
              </div>
              {buildUnitTree(selectedUnit)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
