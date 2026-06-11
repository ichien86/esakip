import { NextResponse } from 'next/server';
import EmployeeService from '@/services/EmployeeService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSystem = searchParams.get('includeSystem') === 'true';
    
    const employees = includeSystem 
      ? await EmployeeService.getAllEmployeesIncludingBupati()
      : await EmployeeService.getAllEmployees();
      
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
