import MasterRepository from '@/repositories/MasterRepository';

class MasterService {
  async getPrograms() {
    return MasterRepository.findPrograms();
  }

  async saveProgram(body) {
    const id = body.id || `mp_${Date.now()}`;
    const { nama } = body;
    
    return MasterRepository.saveProgram({ id, nama });
  }

  async getKegiatans() {
    return MasterRepository.findKegiatans();
  }

  async saveKegiatan(body) {
    const id = body.id || `mk_${Date.now()}`;
    const { programId, nama } = body;
    
    return MasterRepository.saveKegiatan({ id, programId, nama });
  }

  async getSubkegiatans() {
    return MasterRepository.findSubkegiatans();
  }

  async saveSubkegiatan(body) {
    const id = body.id || `msk_${Date.now()}`;
    const { kegiatanId, nama, indikator, satuan } = body;
    
    return MasterRepository.saveSubkegiatan({ id, kegiatanId, nama, indikator, satuan });
  }
}

const masterService = new MasterService();
export default masterService;
