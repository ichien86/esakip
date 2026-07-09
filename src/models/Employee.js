import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nama: { type: String, required: true },
  nip: { type: String, required: true },
  jabatan: { type: String, required: true },
  jenisJabatan: { type: String, enum: ['Pimpinan Tinggi', 'Administrator', 'Pengawas', 'JFT', 'JFU'], default: 'JFU' },
  pangkatGolongan: { type: String, default: '' },
  password: { type: String, default: 'bpbd@boyolali' },
  roles: { type: [String], default: [] },
  parentId: { type: String, default: null },
  bidangs: { type: [String], default: [] },
  pltBidangs: { type: [String], default: [] },
  scopeLeader: { type: String, enum: ['Badan', 'Bidang', 'Sekretariat', 'Tata Usaha', null], default: null },
  isActive: { type: Boolean, default: true },
  signatureUrl: { type: String, default: null },
  hasDigitalSignature: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
