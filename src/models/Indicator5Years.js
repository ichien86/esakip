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
  outputVariableAlias: { type: String, default: '' },
  metodePenghitungan: { type: String, default: 'Tunggal' }, // Tunggal, Persentase, Rata-rata, Penjumlahan, Pembobotan (legacy: Jumlah)
  variabelJumlah: { type: String, default: '' },       // Legacy: Metode Tunggal
  variabelPembilang: { type: String, default: '' },    // Legacy: Metode Persentase
  variabelPenyebut: { type: String, default: '' },     // Legacy: Metode Persentase
  // Variabel dinamis untuk metode Rata-rata, Penjumlahan, Pembobotan
  variables: [
    {
      name: { type: String, required: true },
      weight: { type: Number, default: 1 } // Digunakan untuk metode Pembobotan (0 - 100)
    }
  ],
  order: { type: Number, default: 0 }
}, { timestamps: true });

// Buat indeks pencarian cepat untuk nodeId
Indicator5YearsSchema.index({ nodeId: 1 });

export default mongoose.models.Indicator5Years || mongoose.model('Indicator5Years', Indicator5YearsSchema);
