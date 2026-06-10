import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function PUT(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    const { nama, nip, jabatan, pangkatGolongan, roles, parentId, bidangs, requesterRole, isActive } = body;

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat melakukan manajemen user.' }, { status: 403 });
    }

    const finalRoles = Array.isArray(roles) ? roles : (body.role ? [body.role] : []);
    let finalBidangs = Array.isArray(bidangs) ? bidangs : (body.bidang ? [body.bidang] : []);


    const emp = await Employee.findOne({ id });
    if (!emp) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    let finalScopeLeader = null;
    if (finalRoles.includes('pemimpin')) {
      const leaderBidang = finalBidangs[0] || '';
      if (leaderBidang === 'Badan') {
        finalScopeLeader = 'Badan';
      } else if (leaderBidang === 'Sekretariat') {
        finalScopeLeader = 'Sekretariat';
      } else if (leaderBidang === 'Tata Usaha') {
        finalScopeLeader = 'Tata Usaha';
      } else if (leaderBidang.startsWith('Bidang')) {
        finalScopeLeader = 'Bidang';
      }
    }

    const oldBidangs = emp.bidangs || [];
    const newBidangs = finalBidangs || [];

    // Check if there is a unit kerja transfer
    if (oldBidangs.length > 0 && oldBidangs[0] !== newBidangs[0]) {
      const Selection = (await import('@/models/Selection')).default;
      const CascadingAnnual = (await import('@/models/CascadingAnnual')).default;
      const Renaksi = (await import('@/models/Renaksi')).default;
      const Notification = (await import('@/models/Notification')).default;

      const oldBidang = oldBidangs[0];

      const requestYear = request.headers.get('x-requester-year') || '2026';
      const yearNum = parseInt(requestYear);

      // Get the employee's selection for the selected year
      // Find indicators belonging to the old unit assigned directly to this employee
      const oldUnitIndicators = await CascadingAnnual.find({
        penanggungJawab: id,
        bidangPengampu: oldBidang,
        tahun: yearNum
      });
      const oldUnitIndicatorIds = oldUnitIndicators.map(ind => ind.id);

      if (oldUnitIndicatorIds.length > 0) {
        // Unset penanggungJawab for these indicators
        await CascadingAnnual.updateMany(
          { id: { $in: oldUnitIndicatorIds }, tahun: yearNum },
          { $set: { penanggungJawab: null } }
        );

        // Delete Renaksi records for these detached indicators
        await Renaksi.deleteMany({ employeeId: id, indicatorId: { $in: oldUnitIndicatorIds }, tahun: yearNum });

        // Update legacy selection collection as well for backward compatibility
        const selection = await Selection.findOne({ employeeId: id, tahun: yearNum });
        if (selection && selection.selectedIndicators) {
          selection.selectedIndicators = selection.selectedIndicators.filter(id => !oldUnitIndicatorIds.includes(id));
          await selection.save();
        }

        // Check for each detached indicator if it now has no active penanggung jawab in the old bidang
        for (const indicator of oldUnitIndicators) {
          const activeEmployeesInOldBidang = await Employee.find({
            bidangs: oldBidang,
            isActive: true
          });
          const activePICIds = activeEmployeesInOldBidang.map(e => e.id);
          const activePICJabatans = activeEmployeesInOldBidang.filter(e => e.roles.includes('pemimpin')).map(e => `jabatan:${e.jabatan}`);

          const activePicCount = await CascadingAnnual.countDocuments({
            id: indicator.id,
            tahun: yearNum,
            $or: [
              { penanggungJawab: { $in: activePICIds } },
              { penanggungJawab: { $in: activePICJabatans } }
            ]
          });

          if (activePicCount === 0) {
            const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const newNotif = new Notification({
              id: notifId,
              bidang: oldBidang,
              message: `Pegawai ${emp.nama} telah pindah unit kerja ke ${newBidangs[0]}. Indikator '${indicator.indikator}' (${indicator.text}) kini tidak memiliki penanggung jawab di bidang Anda.`
            });
            await newNotif.save();
          }
        }
      }
    }

    emp.nama = nama;
    emp.nip = nip;
    emp.jabatan = jabatan;
    emp.pangkatGolongan = pangkatGolongan || '';
    emp.roles = finalRoles;
    emp.parentId = parentId || null;
    emp.bidangs = finalBidangs;
    emp.scopeLeader = finalScopeLeader;
    if (isActive !== undefined) {
      emp.isActive = isActive;
    }

    await emp.save();
    return NextResponse.json({ message: 'Data pegawai berhasil diubah', employee: emp });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const requesterRole = request.headers.get('x-requester-role') || '';

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Administrator Sistem yang dapat melakukan manajemen user.' }, { status: 403 });
    }

    const emp = await Employee.findOne({ id });
    if (!emp) {
      return NextResponse.json({ error: 'Pegawai tidak ditemukan' }, { status: 404 });
    }

    // Set active flag to false (deactivation) instead of hard delete
    emp.isActive = false;
    await emp.save();
    return NextResponse.json({ message: 'Pegawai berhasil dinonaktifkan' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
