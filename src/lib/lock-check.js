import { NextResponse } from 'next/server';
import Setting from '@/models/Setting';
import dbConnect from '@/lib/db';

export async function checkPlanningLock(request) {
  await dbConnect();
  
  const requesterRole = request.headers.get('x-requester-role') || '';
  
  // Only check lock if the requester is not system admin (superadmin)
  if (requesterRole === 'admin') {
    return null; // Allowed
  }
  
  const lockSetting = await Setting.findOne({ key: 'planning_locked' });
  if (lockSetting && lockSetting.value === true) {
    return NextResponse.json(
      { error: 'Perencanaan telah dikunci oleh Administrator Sistem dan tidak dapat diubah.' },
      { status: 403 }
    );
  }
  
  return null; // Allowed
}
