import mongoose from 'mongoose';

const PerformanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true },
  tahun: { type: Number, required: true, default: 2026 },
  status: { type: String, default: 'Draft' }, // Draft, Selesai
  targetIKU: { type: [String], default: [] },
  evaluasiAtasan: {
    evaluatorId: { type: String, default: null },
    skorAKIP: { type: Number, default: null },
    predikat: { type: String, default: null },
    catatan: { type: String, default: '' },
    tanggalEvaluasi: { type: String, default: null }
  }
}, { timestamps: true });

export default mongoose.models.Performance || mongoose.model('Performance', PerformanceSchema);
