import mongoose from 'mongoose';

const monthFields = () => ({
  jan: { type: Number, default: 0 },
  feb: { type: Number, default: 0 },
  mar: { type: Number, default: 0 },
  apr: { type: Number, default: 0 },
  mei: { type: Number, default: 0 },
  jun: { type: Number, default: 0 },
  jul: { type: Number, default: 0 },
  agu: { type: Number, default: 0 },
  sep: { type: Number, default: 0 },
  okt: { type: Number, default: 0 },
  nov: { type: Number, default: 0 },
  des: { type: Number, default: 0 },
});

const EvaluasiBulananSchema = new mongoose.Schema({
  bulan: { type: Number, required: true },  // 1-12
  faktorPenghambat: { type: String, default: '' },
  faktorPendorong: { type: String, default: '' },
  alasanTidakTercapai: { type: String, default: '' },
}, { _id: false });

const PaketPekerjaanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  tahun: { type: Number, required: true, default: 2026 },
  subkegiatanId: { type: String, required: true },  // CascadingAnnual node id (level: subkegiatan)
  namaSubkegiatan: { type: String, default: '' },
  namaPaket: { type: String, required: true },
  paguAnggaran: { type: Number, default: 0 },
  
  // Target fisik bulanan (kumulatif, 0-100)
  targetFisik: { type: mongoose.Schema.Types.Mixed, default: {} }, // { jan: 0, feb: 0, ... }

  // Realisasi fisik bulanan
  realisasiFisik: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Realisasi anggaran bulanan (diisi Admin Perencana via import)
  realisasiAnggaran: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Evaluasi per bulan (faktor penghambat/pendorong/alasan)
  evaluasiBulanan: { type: [EvaluasiBulananSchema], default: [] },

  // Status
  isLocked: { type: Boolean, default: false },
}, { timestamps: true });

PaketPekerjaanSchema.index({ tahun: 1, subkegiatanId: 1 });

export default mongoose.models.PaketPekerjaan || mongoose.model('PaketPekerjaan', PaketPekerjaanSchema);
