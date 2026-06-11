import { NextResponse } from 'next/server';
import RenaksiService from '@/services/RenaksiService';

export async function GET(request, { params }) {
  try {
    const { employeeId, tahun } = await params;
    const yearNum = parseInt(tahun);

    const userRenaksi = await RenaksiService.getRenaksiByEmployeeAndYear(employeeId, yearNum);
    return NextResponse.json(userRenaksi);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
