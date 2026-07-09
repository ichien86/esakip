import EmployeeServiceModule from '../EmployeeService';
import EmployeeRepository from '../../repositories/EmployeeRepository';
import Employee from '../../models/Employee';
import CascadingAnnual from '../../models/CascadingAnnual';
import PerjakinDocument from '../../models/PerjakinDocument';

jest.mock('../../repositories/EmployeeRepository');
jest.mock('../../models/Employee');
jest.mock('../../models/CascadingAnnual');
jest.mock('../../models/PerjakinDocument');

describe('EmployeeService Plt Handover', () => {
  let service;

  beforeEach(() => {
    // Because we are using dynamic imports in the class methods (e.g. `await import('@/repositories/EmployeeRepository')`), 
    // standard jest mocking is tricky. For this test, we'll assume the implementation uses the direct mocked imports if we mock them,
    // but actually our refactored code uses dynamic imports. We can mock those too if needed.
    service = new EmployeeServiceModule();
    jest.clearAllMocks();
  });

  it('should format payload correctly based on jenisJabatan Pimpinan Tinggi', async () => {
    EmployeeRepository.findOne.mockResolvedValueOnce(null);

    const payload = await service._prepareEmployeePayload({
      nama: 'Bupati',
      nip: '123',
      jabatan: 'Kepala BPBD',
      jenisJabatan: 'Pimpinan Tinggi',
      roles: [],
      bidangs: [],
      pltBidangs: ['Bidang X']
    }, false);

    expect(payload.roles).toEqual(['pemimpin']);
    expect(payload.bidangs).toEqual(['Badan', 'Bidang X']);
    expect(payload.parentId).toBe('bupati');
    expect(payload.scopeLeader).toBe('Badan');
  });

  it('should trigger handover when new definitive leader is assigned', async () => {
    const oldPlt = {
      id: 'emp_plt',
      pltBidangs: ['Bidang A'],
      bidangs: ['Bidang B', 'Bidang A'],
      save: jest.fn()
    };
    
    Employee.find.mockResolvedValueOnce([oldPlt]);
    Employee.updateMany = jest.fn().mockResolvedValue({ nModified: 1 });
    CascadingAnnual.updateMany = jest.fn().mockResolvedValue({ nModified: 1 });
    PerjakinDocument.updateMany = jest.fn().mockResolvedValue({ nModified: 1 });

    await service._processPltHandover('emp_new_leader', 'Bidang A');

    expect(Employee.find).toHaveBeenCalledWith({ pltBidangs: 'Bidang A', id: { $ne: 'emp_new_leader' }, isActive: true });
    
    // Ensure old PLT bidangs are stripped
    expect(oldPlt.pltBidangs).not.toContain('Bidang A');
    expect(oldPlt.bidangs).not.toContain('Bidang A');
    expect(EmployeeRepository.saveDocument).toHaveBeenCalledWith(oldPlt);

    // Subordinates transferred
    expect(Employee.updateMany).toHaveBeenCalledWith(
      { parentId: 'emp_plt', bidangs: 'Bidang A' },
      { $set: { parentId: 'emp_new_leader' } }
    );

    // Cascading transfer
    expect(CascadingAnnual.updateMany).toHaveBeenCalledWith(
      { penanggungJawab: 'emp_plt', bidangPengampu: 'Bidang A' },
      { $set: { penanggungJawab: 'emp_new_leader' } }
    );

    // Old PLT Perjakin Reset
    expect(PerjakinDocument.updateMany).toHaveBeenCalledWith(
      { employeeId: 'emp_plt', status: { $ne: 'Draft' } },
      { $set: { status: 'Draft' } }
    );
  });
});
