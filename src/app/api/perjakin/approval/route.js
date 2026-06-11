import { NextResponse } from 'next/server';
import PerjakinService from '@/services/PerjakinService';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { employeeId, tahun, newStatus, actorRole, actorName, notes } = payload;

    if (!employeeId || !tahun || !newStatus) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const updatedDocument = await PerjakinService.changeDocumentStatus(
      employeeId, 
      tahun, 
      newStatus, 
      actorRole, 
      actorName, 
      notes
    );

    return NextResponse.json({ message: 'Status berhasil diperbarui', data: updatedDocument });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const supervisorId = searchParams.get('supervisorId');
    const tahun = searchParams.get('tahun') || new Date().getFullYear();

    if (!supervisorId) {
      return NextResponse.json({ error: 'Supervisor ID required' }, { status: 400 });
    }

    // This is a simplified approach. Ideally we'd query PerjakinDocument directly 
    // joining with Employees where parentId = supervisorId.
    // For now, we'll fetch subordinates and check their documents.
    const dbConnect = (await import('@/lib/db')).default;
    await dbConnect();
    
    const Employee = (await import('@/models/Employee')).default;
    const PerjakinDocument = (await import('@/models/PerjakinDocument')).default;

    // Fetch subordinates
    const subordinates = await Employee.find({ parentId: supervisorId }).lean();
    const subIds = subordinates.map(s => s.id);

    // Fetch their documents that need approval
    const pendingDocs = await PerjakinDocument.find({
      employeeId: { $in: subIds },
      tahun: Number(tahun),
      status: 'Menunggu Persetujuan Atasan'
    }).lean();

    // Map the documents back to employee data
    const results = pendingDocs.map(doc => {
      const emp = subordinates.find(s => s.id === doc.employeeId);
      return {
        ...doc,
        _id: doc._id.toString(),
        employeeName: emp.nama,
        employeeJabatan: emp.jabatan,
        employeeNip: emp.nip
      };
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
