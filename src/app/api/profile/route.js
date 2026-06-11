import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function GET(request) {
  try {
    const requesterId = request.headers.get('x-requester-id');
    if (!requesterId) {
      return NextResponse.json({ error: 'Tidak ada sesi aktif.' }, { status: 401 });
    }

    const profile = await EmployeeService.getProfile(requesterId);
    return NextResponse.json(profile);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id');
    if (!requesterId) {
      return NextResponse.json({ error: 'Tidak ada sesi aktif.' }, { status: 401 });
    }

    const data = await request.json();
    const updatedProfile = await EmployeeService.updateProfileSignature(requesterId, data);
    
    return NextResponse.json({ message: 'Profil dan Tanda Tangan berhasil diperbarui', data: updatedProfile });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
