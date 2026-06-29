import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import DashboardService from '@/services/DashboardService';
import NotificationService from '@/services/NotificationService';
import Employee from '@/models/Employee';
import Selection from '@/models/Selection';
import CascadingAnnual from '@/models/CascadingAnnual';
import MasterProgram from '@/models/MasterProgram';
import MasterKegiatan from '@/models/MasterKegiatan';
import MasterSubkegiatan from '@/models/MasterSubkegiatan';
import IndicatorAnnual from '@/models/IndicatorAnnual';
import Indicator5Years from '@/models/Indicator5Years';
import Cascading5Years from '@/models/Cascading5Years';
import { getValidatedUser } from '@/lib/api-auth';

/**
 * All-in-one dashboard data endpoint.
 * Combines 5 separate API calls into a single request to minimize
 * cold starts on Vercel serverless and reduce total network overhead.
 *
 * All sub-queries that don't depend on each other are run concurrently
 * via Promise.all, so the total time ≈ the slowest single query,
 * not the sum of all queries.
 */
export async function GET(request) {
  await dbConnect();

  const { role: requesterRole, user } = getValidatedUser(request, request.headers.get('x-requester-role'));
  const requesterId = request.headers.get('x-requester-id') || '';
  const requesterBidang = request.headers.get('x-requester-bidang') || '';
  const requestYear = request.headers.get('x-requester-year') || '2026';
  const yearNum = parseInt(requestYear);

  const isAdminRole = ['admin', 'admin_bidang', 'perencana'].includes(requesterRole);
  const isNotifRole = ['admin', 'admin_bidang', 'perencana', 'pemimpin'].includes(requesterRole);

  // Run all independent queries concurrently.
  const [summaryResult, tasksResult, deactivatedWarningsResult, masterWarningsResult, notificationsResult] =
    await Promise.allSettled([
      // 1. Summary
      DashboardService.getSummary(yearNum),

      // 2. Tasks & Active Month Targets
      requesterId
        ? DashboardService.getPendingTasksAndActiveTargets(requesterId, requesterRole, yearNum)
        : Promise.resolve({ tasks: [], activeMonthTargets: [] }),

      // 3. Deactivated Warnings (admin only)
      isAdminRole
        ? (async () => {
            const deactivatedEmployees = await Employee.find({ isActive: false });
            if (deactivatedEmployees.length === 0) return [];

            const deactivatedIds = deactivatedEmployees.map(e => e.id);
            const selections = await Selection.find({ employeeId: { $in: deactivatedIds }, tahun: yearNum });
            if (selections.length === 0) return [];

            const indicatorIds = [...new Set(selections.flatMap(s => s.selectedIndicators))];
            if (indicatorIds.length === 0) return [];

            const indicators = await CascadingAnnual.find({ id: { $in: indicatorIds } });
            const warnings = [];

            for (const selection of selections) {
              const employee = deactivatedEmployees.find(e => e.id === selection.employeeId);
              if (!employee) continue;
              for (const indicatorId of selection.selectedIndicators) {
                const indicator = indicators.find(i => i.id === indicatorId);
                if (!indicator) continue;
                if (requesterRole === 'admin_bidang' && !indicator.bidangPengampu.includes(requesterBidang)) continue;
                warnings.push({
                  indicatorId: indicator.id,
                  indicatorText: indicator.indikator,
                  indicatorDetail: indicator.text,
                  indicatorLevel: indicator.level,
                  employeeId: employee.id,
                  employeeNama: employee.nama,
                  employeeJabatan: employee.jabatan,
                  bidangPengampu: indicator.bidangPengampu
                });
              }
            }
            return warnings;
          })()
        : Promise.resolve([]),

      // 4. Master Warnings (admin only)
      isAdminRole
        ? (async () => {
            const [annualNodes, fiveYearNodes, masterPrograms, masterKegiatans, masterSubkegiatans] =
              await Promise.all([
                CascadingAnnual.find({ masterId: { $ne: null } }),
                Cascading5Years.find({ masterId: { $ne: null } }),
                MasterProgram.find({}),
                MasterKegiatan.find({}),
                MasterSubkegiatan.find({})
              ]);

            const annualNodeIds = annualNodes.map(n => n.id);
            const fiveYearNodeIds = fiveYearNodes.map(n => n.id);

            const [annualIndicators, fiveYearIndicators] = await Promise.all([
              IndicatorAnnual.find({ nodeId: { $in: annualNodeIds } }),
              Indicator5Years.find({ nodeId: { $in: fiveYearNodeIds } })
            ]);

            const annualIndicatorsMap = new Map();
            annualIndicators.forEach(ind => {
              if (!annualIndicatorsMap.has(ind.nodeId)) annualIndicatorsMap.set(ind.nodeId, []);
              annualIndicatorsMap.get(ind.nodeId).push(ind);
            });
            const fiveYearIndicatorsMap = new Map();
            fiveYearIndicators.forEach(ind => {
              if (!fiveYearIndicatorsMap.has(ind.nodeId)) fiveYearIndicatorsMap.set(ind.nodeId, []);
              fiveYearIndicatorsMap.get(ind.nodeId).push(ind);
            });

            const programMap = new Map(masterPrograms.map(p => [p.id, p]));
            const kegiatanMap = new Map(masterKegiatans.map(k => [k.id, k]));
            const subkegiatanMap = new Map(masterSubkegiatans.map(s => [s.id, s]));

            const warnings = [];
            const checkNode = (node, type) => {
              if (requesterRole === 'admin_bidang') {
                if (!node.bidangPengampu || !node.bidangPengampu.includes(requesterBidang)) return;
              }

              const nodePlain = typeof node.toObject === 'function' ? node.toObject() : node;
              nodePlain.indicators = (type === 'annual' ? annualIndicatorsMap : fiveYearIndicatorsMap).get(node.id) || [];

              const masterId = nodePlain.masterId;
              let isMismatch = false, masterNama = '', masterKinerja = '', masterIndikator = '', masterSatuan = '';
              let hasNameMismatch = false, hasKinerjaMismatch = false, hasIndicatorMismatch = false;

              if (nodePlain.level === 'program' || nodePlain.level === 'sasaran_program') {
                const master = programMap.get(masterId);
                if (master) { masterNama = master.nama; hasNameMismatch = nodePlain.nomenklatur !== master.nama; isMismatch = hasNameMismatch; }
              } else if (nodePlain.level === 'kegiatan' || nodePlain.level === 'sasaran_kegiatan') {
                const master = kegiatanMap.get(masterId);
                if (master) { masterNama = master.nama; hasNameMismatch = nodePlain.nomenklatur !== master.nama; isMismatch = hasNameMismatch; }
              } else if (nodePlain.level === 'subkegiatan' || nodePlain.level === 'sasaran_subkegiatan') {
                const master = subkegiatanMap.get(masterId);
                if (master) {
                  masterNama = master.nama; masterKinerja = master.kinerja || master.nama;
                  masterIndikator = master.indikator; masterSatuan = master.satuan;
                  let localIndikator = nodePlain.indikator, localSatuan = nodePlain.satuan;
                  if (nodePlain.indicators?.length > 0 && nodePlain.indicators[0]) {
                    localIndikator = nodePlain.indicators[0].indikator || localIndikator;
                    localSatuan = nodePlain.indicators[0].satuan || localSatuan;
                  }
                  if (nodePlain.level === 'subkegiatan') {
                    const actualNomenklatur = nodePlain.nomenklatur || nodePlain.text;
                    hasNameMismatch = actualNomenklatur !== master.nama; hasKinerjaMismatch = false;
                  } else {
                    const actualNomenklatur = nodePlain.nomenklatur || '';
                    const actualKinerja = nodePlain.sasaran || nodePlain.sasaranSubkegiatan || nodePlain.text;
                    hasNameMismatch = actualNomenklatur !== master.nama;
                    hasKinerjaMismatch = actualKinerja !== masterKinerja;
                    nodePlain.displayNomenklatur = actualNomenklatur;
                    nodePlain.displayText = actualKinerja;
                  }
                  hasIndicatorMismatch = localIndikator !== master.indikator || localSatuan !== master.satuan;
                  isMismatch = hasNameMismatch || hasKinerjaMismatch || hasIndicatorMismatch;
                }
              }

              if (isMismatch) {
                let warningIndikator = nodePlain.indikator, warningSatuan = nodePlain.satuan;
                if ((nodePlain.level === 'subkegiatan' || nodePlain.level === 'sasaran_subkegiatan') && nodePlain.indicators?.length > 0 && nodePlain.indicators[0]) {
                  warningIndikator = nodePlain.indicators[0].indikator || warningIndikator;
                  warningSatuan = nodePlain.indicators[0].satuan || warningSatuan;
                }
                warnings.push({
                  nodeId: nodePlain.id, type, level: nodePlain.level,
                  text: nodePlain.displayText !== undefined ? nodePlain.displayText : nodePlain.text,
                  nomenklatur: nodePlain.displayNomenklatur !== undefined ? nodePlain.displayNomenklatur : nodePlain.nomenklatur,
                  indikator: warningIndikator, satuan: warningSatuan,
                  masterId, masterNama, masterKinerja, masterIndikator, masterSatuan,
                  hasNameMismatch, hasKinerjaMismatch, hasIndicatorMismatch,
                  bidangPengampu: nodePlain.bidangPengampu
                });
              }
            };

            const relevantLevels = ['program', 'sasaran_program', 'kegiatan', 'sasaran_kegiatan', 'subkegiatan', 'sasaran_subkegiatan'];
            annualNodes.filter(n => relevantLevels.includes(n.level)).forEach(n => checkNode(n, 'annual'));
            fiveYearNodes.filter(n => relevantLevels.includes(n.level)).forEach(n => checkNode(n, '5years'));
            return warnings;
          })()
        : Promise.resolve([]),

      // 5. Notifications (admin/pemimpin only)
      isNotifRole
        ? NotificationService.getNotifications(requesterRole, requesterBidang).catch(() => [])
        : Promise.resolve([]),
    ]);

  const getValue = (result, fallback) => result.status === 'fulfilled' ? result.value : fallback;

  return NextResponse.json({
    summary: getValue(summaryResult, []),
    tasks: getValue(tasksResult, { tasks: [], activeMonthTargets: [] }),
    deactivatedWarnings: getValue(deactivatedWarningsResult, []),
    masterWarnings: getValue(masterWarningsResult, []),
    notifications: getValue(notificationsResult, []),
  });
}
