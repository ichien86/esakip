'use client';

import React, { useMemo } from 'react';
import { useMetadata } from '@/context/MetadataContext';
import { useSimulationInternal } from '@/context/SimulationInternalContext';

export default function OrganogramPage() {
  const { allEmployees } = useMetadata();
  const { currentUser } = useSimulationInternal();

  const activeEmployees = useMemo(
    () => allEmployees.filter(e => e.id !== 'admin' && e.isActive !== false),
    [allEmployees]
  );

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
              Juga menjabat Plt: {emp.pltBidangs.join(', ')}
            </span>
          </div>
        )}
        <span className="text-muted" style={{ fontSize: '9px' }}>NIP: {emp.nip}</span>
      </div>
    );
  };

  // ── PREPARE VIRTUAL NODES ──────────────────────────────────────
  const virtualNodes = useMemo(() => {
    const nodes = [];
    activeEmployees.forEach(emp => {
      // Definitive node
      const defUnit = (emp.bidangs || []).find(b => !(emp.pltBidangs || []).includes(b)) || emp.bidangs?.[0];
      if (defUnit || !emp.pltBidangs || emp.pltBidangs.length === 0) {
        nodes.push({
          ...emp,
          treeNodeId: `${emp.id}_${defUnit || 'none'}`,
          treeParentId: emp.parentId ? `${emp.parentId}_${defUnit || 'none'}` : null,
          isPltNode: false,
          nodeUnit: defUnit || 'none'
        });
      }

      // Plt nodes
      if (emp.pltBidangs && emp.pltBidangs.length > 0) {
        emp.pltBidangs.forEach(pltUnit => {
          nodes.push({
            ...emp,
            treeNodeId: `${emp.id}_${pltUnit}`,
            // We initially point Plt to the same parent as definitive, we will fix it in the next loop
            treeParentId: emp.parentId ? `${emp.parentId}_${emp.bidangs?.[0] || 'none'}` : null,
            isPltNode: true,
            nodeUnit: pltUnit
          });
        });
      }
    });

    // Fix treeParentId: link subordinate to the parent node matching their unit
    nodes.forEach(node => {
      if (node.parentId) {
        const parentNodes = nodes.filter(n => n.id === node.parentId);
        const exactParentNode = parentNodes.find(n => n.nodeUnit === node.nodeUnit);
        if (exactParentNode) {
          node.treeParentId = exactParentNode.treeNodeId;
        } else {
          // Fallback to definitive parent
          const defParentNode = parentNodes.find(n => !n.isPltNode);
          node.treeParentId = defParentNode ? defParentNode.treeNodeId : null;
        }
      }
    });

    return nodes;
  }, [activeEmployees]);

  // ── MODE: Semua (hierarki penuh) ──────────────────────────────────────
  const buildFullTree = (treeParentId) => {
    const children = virtualNodes.filter(e => e.treeParentId === treeParentId);
    if (children.length === 0) return null;
    return (
      <ul className={children.length > 3 ? 'vertical-layout' : ''}>
        {children.map(node => (
          <li key={node.treeNodeId}>
            {renderNode(node, node.isPltNode, node.isPltNode ? node.nodeUnit : null)}
            {buildFullTree(node.treeNodeId)}
          </li>
        ))}
      </ul>
    );
  };

  const rootNodes = virtualNodes.filter(e => e.treeParentId === null);

  const rootEmployee = activeEmployees.find(e => e.parentId === null);

  // ── MODE: Per Unit Kerja ──────────────────────────────────────────────
  const buildUnitTree = (unitName) => {
    const unitNodes = virtualNodes.filter(n => n.nodeUnit === unitName);
    const unitRoots = unitNodes.filter(n => !unitNodes.some(p => p.treeNodeId === n.treeParentId));

    const buildSub = (parentId) => {
      const children = unitNodes.filter(n => n.treeParentId === parentId);
      if (children.length === 0) return null;
      return (
        <ul className={children.length > 3 ? 'vertical-layout' : ''}>
          {children.map(node => (
            <li key={node.treeNodeId}>
              {renderNode(node, node.isPltNode, node.isPltNode ? node.nodeUnit : null)}
              {buildSub(node.treeNodeId)}
            </li>
          ))}
        </ul>
      );
    };

    if (unitRoots.length === 0) {
      return (
        <ul>
          <li>
            <div className="org-node" style={{ opacity: 0.5, fontStyle: 'italic' }}>
              <p>Belum ada data pegawai untuk unit ini.</p>
            </div>
          </li>
        </ul>
      );
    }

    return (
      <ul>
        {unitRoots.map(rootNode => (
          <li key={rootNode.treeNodeId}>
             {renderNode(rootNode, rootNode.isPltNode, rootNode.isPltNode ? rootNode.nodeUnit : null)}
             {buildSub(rootNode.treeNodeId)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <h3><i className="fa-solid fa-sitemap text-orange" /> Visualisasi Hierarki Organisasi BPBD Boyolali</h3>
        <p className="text-muted">Diagram struktur organisasi BPBD Kabupaten Boyolali.</p>
      </div>

      <div className="panel-body org-chart-container">
        <div className="org-tree">
          {rootNodes.length > 0 ? (
            <ul>
              {rootNodes.map(rootNode => (
                <li key={rootNode.treeNodeId}>
                  {renderNode(rootNode, rootNode.isPltNode, rootNode.isPltNode ? rootNode.nodeUnit : null)}
                  {buildFullTree(rootNode.treeNodeId)}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Memuat bagan organisasi...</p>
          )}
        </div>
      </div>
    </div>
  );
}
