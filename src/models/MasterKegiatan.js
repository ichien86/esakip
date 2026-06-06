import mongoose from 'mongoose';

const MasterKegiatanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  programId: { type: String, required: true },
  nama: { type: String, required: true }
}, { timestamps: true });

export default mongoose.models.MasterKegiatan || mongoose.model('MasterKegiatan', MasterKegiatanSchema);
