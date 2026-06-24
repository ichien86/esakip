import { NextResponse } from 'next/server';
import Setting from '@/models/Setting';
import dbConnect from '@/lib/db';

export async function checkPlanningLock(request, type = 'renstra') {
  await dbConnect();
  
  const requesterRole = request.headers.get('x-requester-role') || '';
  
  // Only check lock if the requester is not system admin (superadmin)
  if (requesterRole === 'admin') {
    return null; // Allowed
  }
  
  const keyToCheck = type === 'renja' ? 'renja_locked' : 'renstra_locked';
  const lockSetting = await Setting.findOne({ key: keyToCheck });

  // Fallback to legacy planning_locked if specific lock doesn't exist yet
  let isLocked = false;
  if (lockSetting) {
    isLocked = lockSetting.value === true;
  } else {
    const legacySetting = await Setting.findOne({ key: 'planning_locked' });
    if (legacySetting) {
      isLocked = legacySetting.value === true;
    }
  }

  if (isLocked) {
    return NextResponse.json(
      { error: `Perencanaan (${type === 'renja' ? 'Renja/PK' : 'Renstra'}) telah dikunci oleh Administrator Sistem dan tidak dapat diubah.` },
      { status: 403 }
    );
  }
  
  return null; // Allowed
}
