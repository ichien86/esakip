import mongoose from 'mongoose';

const Indicator5YearsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nodeId: { type: String, required: true }, // Referensi ke Cascading5Years.id
  indikator: { type: String, required: true },
  satuan: { type: String, required: true },
  tipeTarget: { type: String, required: true }, // Akumulatif, Kondisi Akhir Menurun, Kondisi Akhir Naik
  
  // Target per tahun
  target2025: { type: String, default: '0' },
  target2026: { type: String, default: '0' },
  target2027: { type: String, default: '0' },
  target2028: { type: String, default: '0' },
  target2029: { type: String, default: '0' },
  target2030: { type: String, default: '0' },
  targetAkhir: { type: String, default: '0' },

  // Definisi operasional
  definisiOperasional: { type: String, default: '' },
  metodePenghitungan: { type: String, default: 'Jumlah' }, // Jumlah, Persentase, Lainnya
  variabelJumlah: { type: String, default: '' },
  variabelPembilang: { type: String, default: '' },
  variabelPenyebut: { type: String, default: '' }
}, { timestamps: true });

// Buat indeks pencarian cepat untuk nodeId
Indicator5YearsSchema.index({ nodeId: 1 });

export default mongoose.models.Indicator5Years || mongoose.model('Indicator5Years', Indicator5YearsSchema);
