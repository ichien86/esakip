import mongoose from 'mongoose';

const CascadingAnnualSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  level: { type: String, required: true }, // tujuan, sasaran, program, kegiatan, subkegiatan, aktivitas
  text: { type: String, required: true },
  indikator: { type: String, required: true },
  target: { type: String, required: true },
  satuan: { type: String, required: true },
  tipeTarget: { type: String, required: true }, // Akumulatif, Kondisi Akhir Menurun, Kondisi Akhir Naik
  parentId: { type: String, default: null },
  bidangPengampu: { type: [String], default: [] }, // Array of bidang names (cross-cutting)
  crossCuttingType: { type: String, default: 'shared' }, // shared, split
  splitTargets: { type: mongoose.Schema.Types.Mixed, default: {} }, // { "Bidang A": 5, "Bidang B": 5 }
  tahun: { type: Number, required: true, default: 2026 },
  masterId: { type: String, default: null },
  anggaran: { type: Number, default: 0 },

  // Operational definition and sub-activity targets
  sasaranSubkegiatan: { type: String, default: '' },
  definisiOperasional: { type: String, default: '' },
  metodePenghitungan: { type: String, default: 'Jumlah' }, // Jumlah, Persentase, Lainnya
  variabelJumlah: { type: String, default: '' },
  variabelPembilang: { type: String, default: '' },
  variabelPenyebut: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.CascadingAnnual || mongoose.model('CascadingAnnual', CascadingAnnualSchema);
