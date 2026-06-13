import mongoose from 'mongoose';

const Cascading5YearsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  level: { type: String, required: true }, // tujuan, sasaran, program, kegiatan, subkegiatan, aktivitas
  text: { type: String, required: true },
  indikator: { type: String, required: true },
  satuan: { type: String, required: true },
  tipeTarget: { type: String, required: true }, // Akumulatif, Kondisi Akhir Menurun, Kondisi Akhir Naik
  parentId: { type: String, default: null },
  bidangPengampu: { type: [String], default: [] }, // Array of bidang names (multi-bidang / cross-cutting)
  crossCuttingType: { type: String, default: 'bersama' }, // bersama, digabung
  selectedBidang: { type: String, default: null },
  splitTargets: { type: mongoose.Schema.Types.Mixed, default: {} }, // { "Bidang A": 40, "Bidang B": 60 }
  masterId: { type: String, default: null },
  sasaran: { type: String, default: '' },
  nomenklatur: { type: String, default: '' },
  indicators: { type: [mongoose.Schema.Types.Mixed], default: [] },
  
  // Target per year
  target2025: { type: String, default: '0' },
  target2026: { type: String, default: '0' },
  target2027: { type: String, default: '0' },
  target2028: { type: String, default: '0' },
  target2029: { type: String, default: '0' },
  target2030: { type: String, default: '0' },
  targetAkhir: { type: String, default: '0' },
  
  // Budget (Anggaran) per year
  anggaran2025: { type: String, default: '0' },
  anggaran2026: { type: String, default: '0' },
  anggaran2027: { type: String, default: '0' },
  anggaran2028: { type: String, default: '0' },
  anggaran2029: { type: String, default: '0' },
  anggaran2030: { type: String, default: '0' },
  anggaranAkhir: { type: String, default: '0' },

  // Operational definition and sub-activity targets
  sasaranSubkegiatan: { type: String, default: '' },
  definisiOperasional: { type: String, default: '' },
  metodePenghitungan: { type: String, default: 'Jumlah' }, // Jumlah, Persentase, Lainnya
  variabelJumlah: { type: String, default: '' },
  variabelPembilang: { type: String, default: '' },
  variabelPenyebut: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.Cascading5Years || mongoose.model('Cascading5Years', Cascading5YearsSchema);
