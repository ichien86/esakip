import { NextResponse } from 'next/server';
import MonitoringService from '@/services/MonitoringService';

export async function GET() {
  try {
    const data = await MonitoringService.getMonitoring5YearsData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
