import mongoose from 'mongoose';

const IndicatorAnnualSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nodeId: { type: String, required: true }, // Referensi ke CascadingAnnual.id
  tahun: { type: Number, required: true, default: 2026 },
  indikator: { type: String, required: true },
  target: { type: String, required: true },
  satuan: { type: String, required: true },
  tipeTarget: { type: String, required: true },
  penanggungJawab: { type: String, default: null }, // PIC per indikator!

  // Definisi operasional & variabel penghitungan
  definisiOperasional: { type: String, default: '' },
  metodePenghitungan: { type: String, default: 'Jumlah' }, // Jumlah, Persentase, Lainnya
  variabelJumlah: { type: String, default: '' },
  variabelPembilang: { type: String, default: '' },
  variabelPenyebut: { type: String, default: '' }
}, { timestamps: true });

// Indeks pencarian
IndicatorAnnualSchema.index({ nodeId: 1 });
IndicatorAnnualSchema.index({ penanggungJawab: 1 });
IndicatorAnnualSchema.index({ nodeId: 1, tahun: 1 });

export default mongoose.models.IndicatorAnnual || mongoose.model('IndicatorAnnual', IndicatorAnnualSchema);
