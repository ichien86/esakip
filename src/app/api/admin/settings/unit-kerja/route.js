import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';
import Employee from '@/models/Employee';
import CascadingAnnual from '@/models/CascadingAnnual';
import Cascading5Years from '@/models/Cascading5Years';
import { checkPlanningLock } from '@/lib/lock-check';

export async function GET(request) {
  try {
    await dbConnect();
    const setting = await Setting.findOne({ key: 'master_unit_kerja' });
    if (!setting) {
      return NextResponse.json({ unitKerja: [] });
    }
    return NextResponse.json({ unitKerja: setting.value });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { unitKerja, nameChanges } = body;

    if (!Array.isArray(unitKerja)) {
      return NextResponse.json({ error: 'Format data unit kerja tidak valid.' }, { status: 400 });
    }

    // Save to settings
    let setting = await Setting.findOne({ key: 'master_unit_kerja' });
    if (setting) {
      setting.value = unitKerja;
      await setting.save();
    } else {
      setting = new Setting({
        key: 'master_unit_kerja',
        value: unitKerja
      });
      await setting.save();
    }

    // Process Domino Effect (Name Changes)
    let updateCounts = { employees: 0, cascades: 0 };
    
    if (Array.isArray(nameChanges) && nameChanges.length > 0) {
      for (const change of nameChanges) {
        if (!change.oldName || !change.newName || change.oldName === change.newName) continue;
        
        // 1. Update Employees
        if (change.type === 'bidang' || change.type === 'subUnit') {
          await Employee.updateMany(
            { bidangs: change.oldName },
            { $set: { "bidangs.$": change.newName } }
          );
          await Employee.updateMany(
            { pltBidangs: change.oldName },
            { $set: { "pltBidangs.$": change.newName } }
          );
        }

        // 2. Update Cascading (Renstra & Renja)
        if (change.type === 'bidang') {
          await Cascading5Years.updateMany(
            { bidangPengampu: change.oldName },
            { $set: { "bidangPengampu.$": change.newName } }
          );
          await CascadingAnnual.updateMany(
            { bidangPengampu: change.oldName },
            { $set: { "bidangPengampu.$": change.newName } }
          );
        } else if (change.type === 'subUnit') {
          await Cascading5Years.updateMany(
            { subUnitPengampu: change.oldName },
            { $set: { "subUnitPengampu.$": change.newName } }
          );
          await CascadingAnnual.updateMany(
            { subUnitPengampu: change.oldName },
            { $set: { "subUnitPengampu.$": change.newName } }
          );
        }
      }
    }

    return NextResponse.json({ 
      message: 'Master Unit Kerja berhasil disimpan.', 
      unitKerja: setting.value,
      dominoUpdates: nameChanges?.length || 0
    });

  } catch (error) {
    console.error('Error saving master unit kerja:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
