/**
 * Resolves penanggungJawab for all nodes in the cascading tree bottom-up.
 * Single source of truth is derived from:
 * 1. aktivitas (if any and has penanggungJawab)
 * 2. subkegiatan (fallback if no aktivitas has penanggungJawab, or if no child activities exist)
 * 3. higher levels (kegiatan, program, sasaran, tujuan) inherit derived penanggungJawab from their children
 *
 * @param {Array} annualNodes - The list of annual nodes for a given year.
 * @returns {Array} - The enriched annual nodes with resolved/derived penanggungJawab.
 */
export function resolveTreePICs(annualNodes, annualIndicators = []) {
  const nodesById = {};
  const childrenByParentId = {};
  const indicatorsByNodeId = {};

  // Group indicators by nodeId
  if (Array.isArray(annualIndicators)) {
    annualIndicators.forEach(ind => {
      const rawInd = typeof ind.toObject === 'function' ? ind.toObject() : ind;
      if (!indicatorsByNodeId[rawInd.nodeId]) {
        indicatorsByNodeId[rawInd.nodeId] = [];
      }
      indicatorsByNodeId[rawInd.nodeId].push(rawInd);
    });
  }

  // Initialize and standardize levels
  annualNodes.forEach(node => {
    const rawNode = typeof node.toObject === 'function' ? node.toObject() : node;
    let lvl = rawNode.level;
    if (lvl === 'program') lvl = 'sasaran_program';
    else if (lvl === 'kegiatan') lvl = 'sasaran_kegiatan';
    else if (lvl === 'subkegiatan') lvl = 'sasaran_subkegiatan';
    else if (lvl === 'aktivitas') lvl = 'sasaran_aktivitas';

    nodesById[rawNode.id] = {
      ...rawNode,
      standardLevel: lvl
    };
    
    if (rawNode.parentId) {
      if (!childrenByParentId[rawNode.parentId]) {
        childrenByParentId[rawNode.parentId] = [];
      }
      childrenByParentId[rawNode.parentId].push(rawNode.id);
    }
  });

  const cache = {};

  function getCaretakers(nodeId) {
    if (cache[nodeId]) return cache[nodeId];

    const node = nodesById[nodeId];
    if (!node) return new Set();

    const lvl = node.standardLevel;
    const childrenIds = childrenByParentId[nodeId] || [];

    const isTujuan = lvl === 'tujuan';
    const isSasaran = lvl === 'sasaran';
    const isAktivitas = lvl === 'sasaran_aktivitas' || lvl === 'aktivitas';
    const isSubkegiatan = lvl === 'sasaran_subkegiatan' || lvl === 'subkegiatan';

    if (isTujuan || isSasaran) {
      const pics = new Set(['jabatan:Kepala Pelaksana']);
      cache[nodeId] = pics;
      return pics;
    }

    if (isAktivitas) {
      const pics = new Set();
      const nodeInds = indicatorsByNodeId[nodeId] || [];
      nodeInds.forEach(ind => {
        if (ind.penanggungJawab) {
          pics.add(ind.penanggungJawab);
        }
      });
      if (pics.size === 0 && node.penanggungJawab) {
        pics.add(node.penanggungJawab);
      }
      cache[nodeId] = pics;
      return pics;
    }

    if (isSubkegiatan) {
      const pics = new Set();
      // Look for aktivitas children
      const childAktivitasIds = childrenIds.filter(cid => {
        const c = nodesById[cid];
        return c && (c.standardLevel === 'sasaran_aktivitas' || c.standardLevel === 'aktivitas');
      });

      if (childAktivitasIds.length > 0) {
        for (const cid of childAktivitasIds) {
          const actPics = getCaretakers(cid);
          for (const p of actPics) {
            pics.add(p);
          }
        }
      }

      // If no PIC resolved from child activities, fall back to subkegiatan's own indicators' penanggungJawab
      if (pics.size === 0) {
        const nodeInds = indicatorsByNodeId[nodeId] || [];
        nodeInds.forEach(ind => {
          if (ind.penanggungJawab) {
            pics.add(ind.penanggungJawab);
          }
        });
      }

      // If still empty, fall back to subkegiatan's own penanggungJawab
      if (pics.size === 0 && node.penanggungJawab) {
        pics.add(node.penanggungJawab);
      }

      cache[nodeId] = pics;
      return pics;
    }

    // For higher levels: kegiatan, program, sasaran, tujuan
    const pics = new Set();
    for (const cid of childrenIds) {
      const childPics = getCaretakers(cid);
      for (const p of childPics) {
        pics.add(p);
      }
    }

    cache[nodeId] = pics;
    return pics;
  }

  // Enrich each node with derived penanggungJawab and populate indicators
  return annualNodes.map(node => {
    const rawObj = typeof node.toObject === 'function' ? node.toObject() : node;
    const resolvedSet = getCaretakers(rawObj.id);
    const resolvedPICs = Array.from(resolvedSet).filter(Boolean);
    
    return {
      ...rawObj,
      penanggungJawab: resolvedPICs.length > 0 ? resolvedPICs.join(',') : null,
      indicators: indicatorsByNodeId[rawObj.id] || []
    };
  });
}
