import mongoose from 'mongoose';

const RenaksiSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true },
  bidang: { type: String, default: '' }, // Identifies which bidang submitted this (useful for cross-cutting split mode)
  tahun: { type: Number, required: true, default: 2026 },
  indicatorId: { type: String, required: true },
  bulan: { type: Number, required: true },
  targetBulanan: { type: Number, default: 0 },
  realisasiBulanan: { type: Number, default: null },
  tanggalRealisasi: { type: String, default: null }, // ISO String or null
  buktiDukung: { type: String, default: '' },
  kendala: { type: String, default: '' },
  solusi: { type: String, default: '' },
  faktorPendorong: { type: String, default: '' },
  inovasi: { type: String, default: '' },
  status: { type: String, default: 'Draft' }, // Draft, Diajukan, Disetujui
  isCrossCuttingSelected: { type: Boolean, default: true },
  
  // Realization calculation variables
  variabelJumlahVal: { type: Number, default: null },
  variabelPembilangVal: { type: Number, default: null },
  variabelPenyebutVal: { type: Number, default: null }
}, { timestamps: true });

export default mongoose.models.Renaksi || mongoose.model('Renaksi', RenaksiSchema);
