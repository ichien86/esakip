import mongoose from 'mongoose';

const MasterSubkegiatanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  kegiatanId: { type: String, required: true },
  nama: { type: String, required: true },
  indikator: { type: String, required: true },
  satuan: { type: String, required: true }
}, { timestamps: true });

export default mongoose.models.MasterSubkegiatan || mongoose.model('MasterSubkegiatan', MasterSubkegiatanSchema);
