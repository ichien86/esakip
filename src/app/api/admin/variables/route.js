import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import IndicatorAnnual from '@/models/IndicatorAnnual';
import Indicator5Years from '@/models/Indicator5Years';
import { getValidatedUser } from '@/lib/api-auth';

export async function GET(request) {
  try {
    const { role: requesterRole } = getValidatedUser(request, request.headers.get('x-requester-role'));
    if (!requesterRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Mengambil distinct variable names dari IndicatorAnnual
    const annualVariables = await IndicatorAnnual.distinct('variables.name');
    
    // Mengambil distinct variable names dari Indicator5Years
    const fiveYearsVariables = await Indicator5Years.distinct('variables.name');

    // Menggabungkan dan menghilangkan duplikat
    const allVariables = [...new Set([...annualVariables, ...fiveYearsVariables])].filter(v => v);

    return NextResponse.json(allVariables.sort());
  } catch (error) {
    console.error('Error fetching variables:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
