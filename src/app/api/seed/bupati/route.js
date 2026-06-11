import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

export async function GET(request) {
  try {
    await dbConnect();
    let bupati = await Employee.findOne({ roles: 'bupati' });

    if (!bupati) {
      bupati = new Employee({
        id: 'bupati_boyolali',
        nama: 'M. Said Hidayat, S.H.',
        nip: '-',
        jabatan: 'Bupati Boyolali',
        jenisJabatan: 'Pimpinan Tinggi', // Or whatever
        roles: ['bupati'],
        isActive: true,
        password: 'NO_LOGIN_ALLOWED'
      });
      await bupati.save();
    }

    return Response.json({ message: 'Akun Bupati berhasil disiapkan.', data: bupati });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
